import torch
import torchvision.transforms as transforms
import torchvision.models as models
import torch.nn as nn
from PIL import Image
import numpy as np

class LiTSTumorDetector:
    def __init__(self, model_path, threshold=0.5):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.threshold = threshold
        self.model = self._load_model(model_path)
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    
    def _load_model(self, model_path):
        model = models.resnet18(weights=None)
        in_features = model.fc.in_features
        model.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(in_features, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 2)
        )
        checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        return model.to(self.device)
    
    def predict_slice(self, image_array):
        if image_array.max() <= 1.0:
            image_array = (image_array * 255).astype(np.uint8)
        pil_image = Image.fromarray(image_array).convert('RGB')
        tensor = self.transform(pil_image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            prob = torch.softmax(self.model(tensor), dim=1)[0][1].item()
        return 1 if prob > self.threshold else 0, prob

if __name__ == '__main__':
    detector = LiTSTumorDetector('lits_tumor_model_fixed.pth')
    print('Model ready')