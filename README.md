# MedBridge 💊
> **A safety net between the hospital door and the kitchen table.**

MedBridge is an open, clinically-oriented medication reconciliation and post-discharge safety tool. It parses hospital discharge summaries, extracts medication schedules, runs deterministic clinical safety rules (drug-drug interactions, duplicate generics, maximum daily doses, and high-risk medication red flags), explains the regimen at a Grade-6 reading level in English and Tamil, and verifies patient retention using an interactive teach-back comprehension quiz.

---

## 🌟 Key Features

- **Document Ingestion & OCR**: Upload or capture discharge summaries via camera with automatic quality check and Tesseract OCR / manual confirmation fallback.
- **Pre-baked Clinical Demo Cases**: 6 rich test cases covering drug-drug interactions, duplicate active ingredients, dosage limit exceedance, and red flag medications (Digoxin, Warfarin, Metformin, etc.).
- **Deterministic Rules Engine**: Pure Python safety checker executing without hallucination risks:
  - `R-INT`: Major & moderate drug-drug interactions (e.g. Warfarin + Aspirin, Digoxin + Furosemide).
  - `R-DUP`: Duplicate generic ingredient detection across brand names (e.g. Paracetamol + Crocin).
  - `R-DOSE`: Maximum daily dose ceiling enforcement.
  - `R-FREQ`: Implausible dosing frequency detection.
  - `R-RED`: Black-box and narrow therapeutic index symptom red flags.
- **Explainability**: Every safety alert includes clinical rationale ("Show me why"), citation of clinical sources, and recommended action (`Ask your pharmacist`, `Contact your doctor`, `Seek urgent care`).
- **Patient Accessibility & i18n**:
  - English & Tamil (தமிழ்) dual language support.
  - Grade-6 reading level plain-language summaries.
  - Large text toggle for visual accessibility.
  - Web Speech API text-to-speech audio reader.
- **Teach-Back Comprehension Quiz**: Evaluates patient understanding of doses, timings, and warning signs with instant rationale feedback.
- **Caregiver Safety Net**: Automatically triggers a caregiver handoff prompt when comprehension score falls below 60%.
- **Printable Clinical Summary**: Single-page handoff sheet formatted for community pharmacists and home healthcare nurses.

---

## 🏗️ Architecture

```
medbridge/
├── backend/
│   ├── app/
│   │   ├── rules/            # Pure deterministic clinical safety engine
│   │   │   ├── engine.py     # Rule runner and safety validation
│   │   │   └── data/         # Curated drug database, interactions, and limits
│   │   ├── i18n/             # en.json and ta.json localization files
│   │   ├── extract.py        # OCR text parsing and medication entity extraction
│   │   ├── teachback.py      # Comprehension question generation & scoring
│   │   ├── models.py         # Pydantic data schemas
│   │   └── main.py           # FastAPI REST API endpoints
│   └── tests/
│       └── test_rules_engine.py # 49 deterministic rule engine test cases
├── frontend/                 # Vite + React UI
│   ├── src/
│   │   ├── components/       # Header, StepIndicator, SeverityBadge, Disclaimer
│   │   ├── pages/            # Welcome, Demo, Upload, Confirm, Safety, Medicines, Teachback, Summary
│   │   ├── context.jsx       # Global application state (useReducer)
│   │   ├── i18n.js           # Frontend localization strings
│   │   ├── api.js            # REST API client
│   │   └── index.css         # Modern medical design system & print styles
└── scripts/
    ├── check_env.py          # Environment & dependency validator
    └── test_api.py           # API integration smoke tests
```

---

## 🚀 Getting Started

### Prerequisites
- **Python**: 3.11+
- **Node.js**: 18+ and npm

### Backend Setup
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repo-url>
   cd medbridge
   ```
2. Install Python dependencies:
   ```bash
   pip install fastapi uvicorn pydantic rapidfuzz pytest pillow opencv-python google-genai
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Start the backend server:
   ```bash
   python -m uvicorn backend.app.main:app --port 8000 --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## 🧪 Testing

Run backend clinical rule tests:
```bash
python -m pytest backend/tests
```

Run API smoke integration tests:
```bash
python scripts/test_api.py
```

Build the production frontend:
```bash
cd frontend && npm run build
```

---

## ⚖️ Clinical Disclaimer
**Not Medical Advice**: MedBridge is designed as a patient safety aid and communication bridge between hospital discharge and community pharmacy review. It does not diagnose, prescribe, or unilaterally change medication regimens. All recommendations should be confirmed with a licensed pharmacist or physician.
