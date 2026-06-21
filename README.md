# Check Kontrak

Platform edukasi untuk mengecek klausul kontrak kerja terhadap PP 35/2021 dan peraturan ketenagakerjaan Indonesia lainnya.

## Fitur

- Upload PDF kontrak kerja untuk analisis otomatis
- Deteksi klausul yang berpotensi tidak sesuai dengan peraturan
- Rujukan pasal dengan status hukum (aktif, direvisi, dicabut)
- Visualisasi graph relasi antar pasal
- Disclaimer edukasi - bukan pengganti konsultasi hukum

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| Backend | FastAPI (Python) |
| AI | LlamaIndex + GPT-4o (OpenAI) |
| Graph DB | Kuzu (embedded) |
| Vector DB | ChromaDB (embedded) |
| PDF Parsing | Unstructured API |

## Struktur Proyek

```
cek-kontrak/
├── client/                 # Frontend Next.js
│   ├── app/               # App Router pages
│   │   ├── login/         # Login page
│   │   ├── signup/        # Signup page
│   │   ├── dashboard/     # Main upload & result page
│   │   └── graph/         # Graph visualization page
│   ├── components/        # React components
│   └── lib/               # Utilities & API client
├── server/                # Backend FastAPI
│   ├── app/
│   │   ├── api/v1/       # API endpoints
│   │   │   └── endpoints/ # auth, contract, graph
│   │   ├── core/         # Config, security, dependencies
│   │   ├── services/     # Business logic
│   │   └── models/       # Pydantic schemas
│   ├── scripts/          # Ingest script
│   └── data/             # Regulation PDFs & databases
└── README.md
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- OpenAI API key
- Unstructured API key

### Backend Setup

```bash
cd server

# Install dependencies
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Run ingest script (once)
python -m scripts.ingest_regulations

# Start server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/contract/upload` | Upload & analyze contract |
| GET | `/api/v1/contract/result/{id}` | Get analysis result |
| GET | `/api/v1/graph/data` | Get graph data for visualization |

## Usage

1. Buka `http://localhost:3000`
2. Daftar / Login
3. Upload PDF kontrak kerja
4. Lihat hasil analisis
5. (Opsional) Lihat visualisasi graph

## Disclaimer

**PENTING:** Hasil analisis ini bersifat edukasi awal dan BUKAN pengganti konsultasi hukum profesional. Klausul yang ditandai "perlu dicek" menunjukkan potensi ketidaksesuaian yang sebaiknya dikonsultasikan dengan ahli hukum.

## License

Open source untuk edukasi.
