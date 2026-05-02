# Liver Tumor Detection System

AI-powered liver tumor detection from CT scans using deep learning (ResNet18, LiTS dataset).

## Project Structure

```
├── backend/    FastAPI server — deployed to HuggingFace Spaces (Docker)
└── frontend/   Next.js web app — Firebase Auth + Firestore
```

## Quick Start

### Backend
Deployed at: `https://hashammubarak1-liver-tumor-detection-api.hf.space`

To run locally:
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
cp .env.local.example .env.local   # fill in Firebase credentials
npm install
npm run dev
```

## Tech Stack
- **Model**: ResNet18 (PyTorch), trained on LiTS dataset, frozen early layers
- **Detection logic**: 70% slice threshold + 11% affected ratio cutoff
- **Backend**: FastAPI, deployed to HuggingFace Spaces (Docker)
- **Frontend**: Next.js, React, Tailwind CSS v4, TypeScript
- **Auth & DB**: Firebase Authentication + Firestore
