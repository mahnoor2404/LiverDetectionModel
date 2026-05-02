---
title: Liver Tumor Detection API
emoji: 🩺
colorFrom: purple
colorTo: blue
sdk: docker
pinned: false
---

# Liver Tumor Detection API

FastAPI backend for liver tumor detection using ResNet18 trained on the LiTS dataset.

## Endpoints
- `GET  /health`   — health check
- `POST /predict`  — run detection on CT scan (NIfTI or image)
- `POST /evaluate` — submit ground truth
- `GET  /metrics`  — get evaluation metrics
- `POST /reset_evaluation` — clear metrics

## Environment Variables (set in Space Settings)
- `HF_MODEL_REPO` — HuggingFace model repo ID (e.g. `yourname/lits_tumor_model_fixed.pth`)
- `HF_TOKEN`      — required only if the model repo is private
