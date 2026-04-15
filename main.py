import os
import json
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models
from PIL import Image
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import warnings
from datetime import datetime
from typing import Dict, List
import hashlib
warnings.filterwarnings("ignore")

try:
    import nibabel as nib
    NIBABEL_AVAILABLE = True
    print("✅ NIfTI support enabled (nibabel loaded)")
except ImportError:
    NIBABEL_AVAILABLE = False
    print("⚠️ nibabel not installed")

app = FastAPI(title="Liver Tumor Detection API - Model 1 (Frozen Layers)", version="5.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

print("=" * 50)
print("LIVER TUMOR DETECTION API - MODEL 1")
print("With Layer Freezing + Intelligent Post-Processing")
print("=" * 50)

device = torch.device("cpu")
print(f"✅ Device: {device}")

# ============================================
# LOAD MODEL 1 (with layer freezing architecture)
# ============================================
def load_model1():
    """Load Model 1 with the same architecture it was trained with"""
    model = models.resnet18(weights=None)
    
    # Freeze early layers (as in your training)
    for name, param in model.named_parameters():
        if 'layer4' not in name and 'fc' not in name:
            param.requires_grad = False
    
    # Custom classifier (same as training)
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(in_features, 256),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(256, 2)
    )
    
    return model

# Load model
model = load_model1()
model_path = os.path.join(MODEL_DIR, "lits_tumor_model_fixed.pth")

# Try to find the model file in different locations
if not os.path.exists(model_path):
    # Check alternative locations
    alt_paths = [
        os.path.join(BASE_DIR, "lits_tumor_model_fixed.pth"),
        os.path.join(BASE_DIR, "lits_tumor_model.pth"),
        os.path.join(BASE_DIR, "model", "best_model.pth"),
    ]
    for alt in alt_paths:
        if os.path.exists(alt):
            model_path = alt
            break

print(f"Loading model from: {model_path}")
state_dict = torch.load(model_path, map_location=device, weights_only=False)

# Handle different state_dict formats
if 'model_state_dict' in state_dict:
    state_dict = state_dict['model_state_dict']
elif 'state_dict' in state_dict:
    state_dict = state_dict['state_dict']

# Remove 'resnet.' prefix if present
new_state_dict = {}
for key, value in state_dict.items():
    if key.startswith('resnet.'):
        new_key = key[7:]
    elif key.startswith('module.'):
        new_key = key[7:]
    else:
        new_key = key
    new_state_dict[new_key] = value

model.load_state_dict(new_state_dict, strict=True)
model.to(device)
model.eval()
print("✅ Model 1 loaded successfully!")

# ============================================
# EVALUATION METRICS (in-memory)
# ============================================
class EvaluationMetrics:
    def __init__(self):
        self.results = []
    
    def add_result(self, filename, predicted_class, actual_class, confidence, slices_analyzed=None, affected_ratio=None):
        result = {
            "id": hashlib.md5(f"{filename}{datetime.now()}".encode()).hexdigest()[:8],
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
            "predicted_class": predicted_class,
            "actual_class": actual_class,
            "confidence": confidence,
            "slices_analyzed": slices_analyzed,
            "affected_ratio": affected_ratio
        }
        self.results.append(result)
        return result
    
    def reset_all_data(self):
        self.results = []
    
    def get_confusion_matrix(self):
        tp = tn = fp = fn = 0
        for r in self.results:
            if r.get('actual_class'):
                if r['predicted_class'] == 'tumor' and r['actual_class'] == 'tumor':
                    tp += 1
                elif r['predicted_class'] == 'non-tumor' and r['actual_class'] == 'non-tumor':
                    tn += 1
                elif r['predicted_class'] == 'tumor' and r['actual_class'] == 'non-tumor':
                    fp += 1
                elif r['predicted_class'] == 'non-tumor' and r['actual_class'] == 'tumor':
                    fn += 1
        return {"TP": tp, "TN": tn, "FP": fp, "FN": fn}
    
    def calculate_metrics(self):
        cm = self.get_confusion_matrix()
        tp, tn, fp, fn = cm['TP'], cm['TN'], cm['FP'], cm['FN']
        
        accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return {
            "accuracy": accuracy * 100,
            "precision": precision * 100,
            "recall": recall * 100,
            "specificity": specificity * 100,
            "f1_score": f1_score * 100,
            "total_samples": tp + tn + fp + fn,
            "true_positives": tp,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn
        }

evaluator = EvaluationMetrics()

# ============================================
# PREPROCESSING (SAME AS YOUR TRAINING)
# ============================================
def preprocess_ct_slice(slice_2d: np.ndarray) -> torch.Tensor:
    """Preprocess a single CT slice - MATCHES YOUR TRAINING PREPROCESSING"""
    img = slice_2d.astype(np.float32)
    
    # Min-max normalization to [0, 1] (YOUR training preprocessing)
    min_val = img.min()
    max_val = img.max()
    if max_val - min_val > 0:
        img = (img - min_val) / (max_val - min_val)
    else:
        img = img - min_val
    
    # Convert to 3-channel (model expects RGB)
    img = np.stack([img, img, img], axis=0)
    
    # Resize to 224x224 (model input size)
    img = torch.from_numpy(img).float()
    img = F.interpolate(
        img.unsqueeze(0), size=(224, 224),
        mode='bilinear', align_corners=False
    ).squeeze(0)
    
    # Normalize with ImageNet stats (model's transform expects this)
    mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
    img = (img - mean) / std
    
    return img.unsqueeze(0)

def extract_all_slices_from_nifti(nifti_data: bytes):
    """Extract and process ALL slices from the volume"""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.nii', delete=False) as f:
        f.write(nifti_data)
        tmp_path = f.name
    try:
        nii = nib.load(tmp_path)
        data = nii.get_fdata()
        num_slices = data.shape[2]
        print(f"Volume shape: {data.shape}")
        print(f"Processing ALL {num_slices} slices...")
        
        all_tensors = []
        for i in range(num_slices):
            tensor = preprocess_ct_slice(data[:, :, i])
            all_tensors.append(tensor)
        
        print(f"✅ Processed {len(all_tensors)} slices")
        return all_tensors, data
    finally:
        os.unlink(tmp_path)

def run_inference(tensor: torch.Tensor) -> float:
    """Run inference on a single tensor"""
    tensor = tensor.to(device)
    with torch.no_grad():
        output = model(tensor)
        prob = torch.softmax(output, dim=1)[0, 1].item()
    return prob

def advanced_tumor_detection(all_probs):
    """
    SAME LOGIC AS MODEL 2:
    - Count slices with probability > 70%
    - If affected ratio > 11% -> TUMOR, else HEALTHY
    """
    probs = np.array(all_probs)
    num_slices = len(probs)
    
    if num_slices == 0:
        return False, 0.0, "No slices to analyze"
    
    # Calculate metrics
    max_prob = np.max(probs)
    mean_prob = np.mean(probs)
    
    # Count slices above 70% threshold
    threshold_70 = 0.70
    slices_above_70 = np.sum(probs > threshold_70)
    ratio_70 = (slices_above_70 / num_slices) * 100
    
    print(f"\n📊 DETECTION METRICS:")
    print(f"   Max probability: {max_prob:.3f}")
    print(f"   Mean probability: {mean_prob:.3f}")
    print(f"   Slices >70%: {slices_above_70}/{num_slices} ({ratio_70:.1f}%)")
    
    # SIMPLE THRESHOLD LOGIC (same as Model 2)
    if ratio_70 <= 11:
        confidence = min(0.30, (ratio_70 / 100) * 0.8)
        return False, confidence, f"HEALTHY: Affected ratio = {ratio_70:.1f}% (≤11% threshold)"
    else:
        confidence = min(0.95, 0.50 + (ratio_70 / 100) * 0.5)
        return True, confidence, f"TUMOR: Affected ratio = {ratio_70:.1f}% (>11% threshold)"

def preprocess_image_file(image: Image.Image) -> torch.Tensor:
    """Preprocess a single image file"""
    image = image.convert('L')
    img_array = np.array(image).astype(np.float32)
    return preprocess_ct_slice(img_array)

# ============================================
# HTML PAGE (same as Model 2)
# ============================================
HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Liver Tumor Detection - Model 1 (Frozen Layers)</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
  }
  .container {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    border-radius: 20px;
    padding: 30px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  h1 { text-align:center; color:#333; margin-bottom:8px; font-size:26px; }
  .subtitle { text-align:center; color:#777; margin-bottom:25px; font-size:14px; }
  .badge {
    background: #667eea;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    display: inline-block;
    margin-bottom: 15px;
  }
  .two-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .column {
    background: #f8f9fa;
    border-radius: 15px;
    padding: 20px;
  }
  .upload-area {
    border: 3px dashed #ccc;
    border-radius: 15px;
    padding: 35px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    margin-bottom: 15px;
    background: #fafafa;
  }
  .upload-area:hover { border-color:#667eea; background:#f0f2ff; }
  .upload-icon { font-size:48px; margin-bottom:10px; }
  .upload-area p { color:#555; font-size:15px; }
  .formats { font-size:12px; color:#aaa; margin-top:8px; }
  .file-info {
    margin-bottom: 15px;
    padding: 10px 15px;
    background: #f0f7ff;
    border: 1px solid #cce0ff;
    border-radius: 10px;
    font-size: 13px;
    color: #336;
    display: none;
  }
  .analyze-btn {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    padding: 14px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 30px;
    cursor: pointer;
    width: 100%;
    transition: transform 0.2s, opacity 0.2s;
  }
  .analyze-btn:hover:not(:disabled) { transform: translateY(-2px); }
  .analyze-btn:disabled { opacity:0.45; cursor:not-allowed; }
  .loading {
    display: none;
    text-align: center;
    margin: 25px 0;
  }
  .spinner {
    border: 4px solid #eee;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    width: 44px; height: 44px;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 12px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .result-box {
    display: none;
    margin-top: 25px;
    border-radius: 15px;
    padding: 25px 20px;
    text-align: center;
    animation: fadeIn 0.4s ease;
  }
  @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .result-box.tumor    { background:#fff0f0; border: 2px solid #e74c3c; }
  .result-box.no-tumor { background:#f0fff4; border: 2px solid #27ae60; }
  .result-icon  { font-size:50px; margin-bottom:10px; }
  .result-title { font-size: 24px; font-weight: 700; margin-bottom: 18px; }
  .result-box.tumor    .result-title { color:#c0392b; }
  .result-box.no-tumor .result-title { color:#1e8449; }
  .bar-section { margin: 10px 0; text-align:left; }
  .bar-label { font-size: 13px; color: #555; margin-bottom: 4px; display: flex; justify-content: space-between; }
  .bar-track { background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 10px; transition: width 1s ease; }
  .bar-fill.tumor-fill { background: linear-gradient(90deg, #e74c3c, #c0392b); }
  .meta-info { margin-top: 15px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
  .decision-reason { margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 8px; font-size: 11px; color: #666; }
  .ground-truth { margin: 15px 0; padding: 15px; background: white; border-radius: 10px; }
  .radio-group { display: flex; gap: 20px; margin: 10px 0; }
  .radio-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .submit-eval-btn { background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: 600; margin-top: 10px; }
  .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 15px 0; }
  .metric-card { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px; border-radius: 10px; text-align: center; }
  .metric-value { font-size: 24px; font-weight: bold; }
  .metric-label { font-size: 12px; opacity: 0.9; }
  .confusion-matrix { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 10px; }
  .matrix-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  .matrix-table td, .matrix-table th { border: 2px solid #ddd; padding: 15px; text-align: center; font-weight: bold; }
  .matrix-table th { background: #667eea; color: white; }
  .tp-cell { background: #d4edda; color: #155724; }
  .tn-cell { background: #d4edda; color: #155724; }
  .fp-cell { background: #f8d7da; color: #721c24; }
  .fn-cell { background: #f8d7da; color: #721c24; }
  .progress-bar { width: 100%; background-color: #e0e0e0; border-radius: 10px; margin: 8px 0; overflow: hidden; }
  .progress-fill { height: 25px; border-radius: 10px; transition: width 0.5s; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: white; font-size: 12px; font-weight: bold; }
  .button-group { display: flex; gap: 10px; margin-bottom: 15px; }
  .refresh-btn { background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; flex: 1; }
  .reset-btn { background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; flex: 1; }
  .info-footer { margin-top: 20px; padding: 12px 15px; background: #f8f9fa; border-radius: 10px; font-size: 12px; color: #888; text-align: center; }
  .note { background: #fff3cd; border: 1px solid #ffc107; padding: 8px; border-radius: 8px; font-size: 11px; margin-top: 10px; text-align: center; }
</style>
</head>
<body>
<div class="container">
  <div style="text-align:center">
    <span class="badge">🎯 MODEL 1: FROZEN LAYERS + 70%/11% LOGIC</span>
  </div>
  <h1>🩺 Liver Tumor Detection</h1>
  <p class="subtitle">With Layer Freezing + Intelligent Post-Processing (70% threshold, 11% affected ratio)</p>

  <div class="two-columns">
    <div class="column">
      <h3 style="margin-bottom:15px">📊 Analysis Panel</h3>
      <div class="upload-area" id="uploadArea">
        <div class="upload-icon">📂</div>
        <p><strong>Click to upload</strong> or drag &amp; drop a file</p>
        <div class="formats">Supported: NIfTI (.nii, .nii.gz) &nbsp;·&nbsp; Images (.jpg, .jpeg, .png)</div>
        <input type="file" id="fileInput" accept=".nii,.nii.gz,.jpg,.jpeg,.png" style="display:none">
      </div>
      <div class="file-info" id="fileInfo"></div>
      <button class="analyze-btn" id="analyzeBtn" disabled>🔍 Analyze Full Volume</button>
      <div class="loading" id="loading">
        <div class="spinner"></div>
        <p>Analyzing all slices, please wait...</p>
      </div>
      <div class="result-box" id="resultBox">
        <div class="result-icon" id="resultIcon"></div>
        <div class="result-title" id="resultTitle"></div>
        <div class="bar-section">
          <div class="bar-label"><span>Confidence Score</span><span id="tumorPct"></span></div>
          <div class="bar-track"><div class="bar-fill tumor-fill" id="tumorBar" style="width:0%"></div></div>
        </div>
        <div class="meta-info" id="metaInfo"></div>
        <div class="decision-reason" id="decisionReason"></div>
        <div class="ground-truth" id="groundTruthSection" style="display:none">
          <hr style="margin:15px 0">
          <p><strong>📝 Is this analysis correct?</strong></p>
          <div class="radio-group">
            <label class="radio-label"><input type="radio" name="actualClass" value="tumor"> ✅ Yes, it's a TUMOR</label>
            <label class="radio-label"><input type="radio" name="actualClass" value="non-tumor"> ❌ No, it's NON-TUMOR</label>
          </div>
          <button class="submit-eval-btn" onclick="submitEvaluation()">📊 Submit for Evaluation</button>
        </div>
      </div>
    </div>

    <div class="column">
      <h3 style="margin-bottom:15px">📈 Performance Metrics</h3>
      <div class="button-group">
        <button class="refresh-btn" onclick="refreshMetrics()">🔄 Refresh Metrics</button>
        <button class="reset-btn" onclick="resetAllData()">🗑️ Reset All Data</button>
      </div>
      <div id="metricsContent"><div class="loading-metrics" style="text-align:center; padding:20px">Loading metrics...</div></div>
      <div class="note">
        ℹ️ Detection Rule: HEALTHY if affected slices ≤11% | TUMOR if >11%<br>
        📊 Model 1: Frozen early layers + Dropout + 2-layer FC
      </div>
    </div>
  </div>
  <div class="info-footer">
    <strong>Same Logic as Model 2:</strong> 70% slice threshold + 11% affected ratio cutoff
  </div>
</div>

<script>
let currentResult = null;
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfoEl = document.getElementById('fileInfo');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingEl = document.getElementById('loading');
const resultBox = document.getElementById('resultBox');
let selectedFile = null;

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = '#667eea'; uploadArea.style.background = '#f0f2ff'; });
uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#ccc'; uploadArea.style.background = '#fafafa'; });
uploadArea.addEventListener('drop', e => { e.preventDefault(); uploadArea.style.borderColor = '#ccc'; uploadArea.style.background = '#fafafa'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

function handleFile(file) {
  selectedFile = file;
  const isNifti = file.name.toLowerCase().endsWith('.nii') || file.name.toLowerCase().endsWith('.nii.gz');
  const sizeMB = (file.size / 1024 / 1024).toFixed(1);
  fileInfoEl.innerHTML = '✅ <strong>' + file.name + '</strong> (' + (isNifti ? 'NIfTI Volume' : 'Image') + ', ' + sizeMB + ' MB)';
  fileInfoEl.style.display = 'block';
  analyzeBtn.disabled = false;
  resultBox.style.display = 'none';
}

analyzeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  analyzeBtn.disabled = true;
  loadingEl.style.display = 'block';
  resultBox.style.display = 'none';
  const fd = new FormData();
  fd.append('file', selectedFile);
  try {
    const response = await fetch('/predict', { method: 'POST', body: fd });
    const data = await response.json();
    loadingEl.style.display = 'none';
    if (data.error) { alert('Error: ' + data.error); analyzeBtn.disabled = false; return; }
    currentResult = data;
    const isTumor = (data.result_class === 'tumor');
    const confidence = parseFloat(data.tumor_probability);
    resultBox.className = 'result-box ' + (isTumor ? 'tumor' : 'no-tumor');
    document.getElementById('resultIcon').textContent = isTumor ? '⚠️' : '✅';
    document.getElementById('resultTitle').textContent = data.prediction;
    document.getElementById('tumorPct').textContent = confidence.toFixed(1) + '%';
    resultBox.style.display = 'block';
    document.getElementById('groundTruthSection').style.display = 'block';
    setTimeout(() => { document.getElementById('tumorBar').style.width = confidence + '%'; }, 100);
    let meta = '';
    if (data.slices_analyzed) meta += '📊 Slices analyzed: ' + data.slices_analyzed + '  &nbsp;·&nbsp;  ';
    if (data.affected_ratio) meta += 'Affected: ' + data.affected_ratio;
    document.getElementById('metaInfo').innerHTML = meta;
    if (data.decision_reason) document.getElementById('decisionReason').innerHTML = '🧠 ' + data.decision_reason;
  } catch (err) { loadingEl.style.display = 'none'; alert('Request failed: ' + err.message); }
  finally { analyzeBtn.disabled = false; }
});

async function submitEvaluation() {
  if (!currentResult) return;
  const selectedRadio = document.querySelector('input[name="actualClass"]:checked');
  if (!selectedRadio) { alert('Please select whether the analysis is correct or not'); return; }
  const actualClass = selectedRadio.value;
  const fd = new FormData();
  fd.append('filename', selectedFile.name);
  fd.append('predicted_class', currentResult.result_class);
  fd.append('actual_class', actualClass);
  fd.append('confidence', currentResult.tumor_probability);
  fd.append('slices_analyzed', currentResult.slices_analyzed || '');
  fd.append('affected_ratio', currentResult.affected_ratio || '');
  const response = await fetch('/evaluate', { method: 'POST', body: fd });
  const result = await response.json();
  if (result.success) { alert('✅ Evaluation recorded!'); document.getElementById('groundTruthSection').style.display = 'none'; refreshMetrics(); }
  else { alert('Error recording evaluation'); }
}

async function resetAllData() {
  if (confirm('⚠️ Are you sure you want to reset ALL evaluation data?')) {
    await fetch('/reset_evaluation', { method: 'POST' });
    alert('✅ All evaluation data has been reset!');
    refreshMetrics();
  }
}

async function refreshMetrics() {
  const response = await fetch('/metrics');
  const data = await response.json();
  if (data.success) {
    const m = data.metrics;
    const html = `<div class="metrics-dashboard"><div class="metrics-grid">
      <div class="metric-card"><div class="metric-value">${m.accuracy.toFixed(1)}%</div><div class="metric-label">Accuracy</div></div>
      <div class="metric-card"><div class="metric-value">${m.precision.toFixed(1)}%</div><div class="metric-label">Precision</div></div>
      <div class="metric-card"><div class="metric-value">${m.recall.toFixed(1)}%</div><div class="metric-label">Recall</div></div>
      <div class="metric-card"><div class="metric-value">${m.specificity.toFixed(1)}%</div><div class="metric-label">Specificity</div></div>
      <div class="metric-card"><div class="metric-value">${m.f1_score.toFixed(1)}%</div><div class="metric-label">F1-Score</div></div>
    </div>
    <div class="confusion-matrix"><h4>Confusion Matrix</h4>
      <table class="matrix-table"><tr><th></th><th>Predicted Tumor</th><th>Predicted Non-Tumor</th></tr>
      <tr><th>Actual Tumor</th><td class="tp-cell">TP: ${m.true_positives}</td><td class="fn-cell">FN: ${m.false_negatives}</td></tr>
      <tr><th>Actual Non-Tumor</th><td class="fp-cell">FP: ${m.false_positives}</td><td class="tn-cell">TN: ${m.true_negatives}</td></tr>
      </table></div>
      <div class="stats"><strong>Total:</strong> ${m.total_samples} | TP:${m.true_positives} | TN:${m.true_negatives} | FP:${m.false_positives} | FN:${m.false_negatives}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${m.accuracy}%; background:linear-gradient(90deg,#2ecc71,#27ae60);">Acc: ${m.accuracy.toFixed(1)}%</div></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${m.precision}%; background:linear-gradient(90deg,#3498db,#2980b9);">Prec: ${m.precision.toFixed(1)}%</div></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${m.recall}%; background:linear-gradient(90deg,#e74c3c,#c0392b);">Rec: ${m.recall.toFixed(1)}%</div></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${m.f1_score}%; background:linear-gradient(90deg,#9b59b6,#8e44ad);">F1: ${m.f1_score.toFixed(1)}%</div></div>
    </div>`;
    document.getElementById('metricsContent').innerHTML = html;
  }
}
refreshMetrics();
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
async def home():
    return HTMLResponse(content=HTML_PAGE)

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model": "Model 1 (Frozen Layers)",
        "nifti_support": NIBABEL_AVAILABLE,
        "detection_logic": "70% slice threshold + 11% affected ratio cutoff"
    }

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    filename = file.filename.lower()
    is_nifti = filename.endswith('.nii') or filename.endswith('.nii.gz')
    is_image = filename.endswith(('.jpg', '.jpeg', '.png'))

    if not (is_nifti or is_image):
        return JSONResponse(status_code=400, content={"error": "Use .nii, .nii.gz, .jpg, or .png"})

    try:
        contents = await file.read()
        
        if is_nifti:
            if not NIBABEL_AVAILABLE:
                return JSONResponse(status_code=500, content={"error": "pip install nibabel"})
            
            print("\n" + "="*50)
            print(f"MODEL 1 PROCESSING: {filename}")
            print("="*50)
            
            all_tensors, volume_data = extract_all_slices_from_nifti(contents)
            
            print("Running inference on all slices...")
            raw_probs = []
            total_slices = len(all_tensors)
            
            for i, tensor in enumerate(all_tensors):
                prob = run_inference(tensor)
                raw_probs.append(prob)
                if (i + 1) % 50 == 0 or (i + 1) == total_slices:
                    print(f"   Processed {i+1}/{total_slices} slices...")
            
            is_tumor, confidence, reason = advanced_tumor_detection(raw_probs)
            
            probs_array = np.array(raw_probs)
            high_prob_slices = np.sum(probs_array > 0.70)
            ratio_70 = (high_prob_slices / len(raw_probs)) * 100
            
            resp = {
                "prediction": "Tumor Detected" if is_tumor else "No Tumor Detected",
                "result_class": "tumor" if is_tumor else "non-tumor",
                "tumor_probability": round(confidence * 100, 2),
                "non_tumor_probability": round((1 - confidence) * 100, 2),
                "slices_analyzed": len(all_tensors),
                "max_probability": round(float(np.max(probs_array)), 3),
                "mean_probability": round(float(np.mean(probs_array)), 3),
                "affected_slices": f"{high_prob_slices}/{len(all_tensors)}",
                "affected_ratio": f"{ratio_70:.1f}%",
                "decision_reason": reason
            }
            
            print(f"\n✅ Final Decision: {'TUMOR' if is_tumor else 'HEALTHY'}")
            print(f"   Confidence: {confidence:.1%}")
            print(f"   Reason: {reason}")
            print("="*50 + "\n")
            
        else:
            image = Image.open(io.BytesIO(contents))
            tensor = preprocess_image_file(image)
            raw_prob = run_inference(tensor)
            is_tumor = raw_prob > 0.75
            confidence = raw_prob if is_tumor else 1 - raw_prob
            
            resp = {
                "prediction": "Tumor Detected" if is_tumor else "No Tumor Detected",
                "result_class": "tumor" if is_tumor else "non-tumor",
                "tumor_probability": round(confidence * 100, 2),
                "non_tumor_probability": round((1 - confidence) * 100, 2),
                "decision_reason": "Single image analysis (less reliable than full volume)"
            }

        return JSONResponse(content=resp)

    except Exception as e:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/evaluate")
async def evaluate_prediction(
    filename: str = Form(...),
    predicted_class: str = Form(...),
    actual_class: str = Form(...),
    confidence: float = Form(...),
    slices_analyzed: str = Form(None),
    affected_ratio: str = Form(None)
):
    try:
        evaluator.add_result(
            filename=filename,
            predicted_class=predicted_class,
            actual_class=actual_class,
            confidence=confidence,
            slices_analyzed=int(slices_analyzed) if slices_analyzed and slices_analyzed != 'None' else None,
            affected_ratio=affected_ratio
        )
        return JSONResponse(content={"success": True, "message": "Evaluation recorded"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.get("/metrics")
async def get_metrics():
    try:
        metrics = evaluator.calculate_metrics()
        return JSONResponse(content={"success": True, "metrics": metrics})
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.post("/reset_evaluation")
async def reset_evaluation():
    evaluator.reset_all_data()
    return JSONResponse(content={"success": True, "message": "Evaluation data reset"})

if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 50)
    print("🚀 MODEL 1: FROZEN LAYERS + 70%/11% LOGIC")
    print("=" * 50)
    print("URL: http://localhost:8000")
    print("\nDetection Logic (SAME AS MODEL 2):")
    print("  - Calculates percentage of slices with >70% tumor probability")
    print("  - If affected <= 11% → HEALTHY")
    print("  - If affected > 11% → TUMOR")
    print("\nModel Architecture:")
    print("  - ResNet18 with frozen early layers")
    print("  - Dropout(0.5) + Linear(256) + ReLU + Dropout(0.3) + Linear(2)")
    print("=" * 50 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)