# 🎓 Scholarship Admin Platform

> **SIH Problem Statement SIH26238**: Modernizing scholarship and fellowship administration for the Ministry of Social Justice & Empowerment (MoSJE) through a unified, config-driven lifecycle management platform.

A full-stack, enterprise-grade admin platform and citizen portal designed to administer central scholarship and fellowship schemes — from dynamic intake and automated eligibility evaluation, through OCR-assisted document scrutiny and selection committee workflows, to post-selection disbursement tracking and annual renewal review cycles.

---

## 🌟 Key Highlights & Engineering Philosophy

- **Zero-Code Scheme Configurability**: Administer structurally distinct schemes (e.g. domestic research fellowship *NFST* vs. international study *NOS*) on the exact same backend engine purely via declarative JSON schema configurations.
- **AI-Powered Document Verification**: Automated OCR pipeline with regex/heuristic field extraction and multi-reason stacked deficiency classification (`MISSING_FIELD`, `FORMAT_INVALID`, `EXPIRED_DATE`).
- **Resilient Unhappy Path & Citizen Remediation**: Rather than opaque rejections, applicants receive granular, actionable feedback with seamless 1-click document resubmission that automatically transitions applications out of deficient status.
- **Role-Based Workflow Separation**: Strict role-based access control (RBAC) across Super Admins, Scheme Directors, Scrutiny Officers, and Selection Committees with zero role cross-contamination.
- **First-Class Post-Selection Management**: Dedicated domain for financial tranches, PFMS/DBT disbursement status, and annual academic continuation review cycles.
- **Immutable Audit Trail**: Every status change, document verification, and committee resolution records a cryptographic actor-attributed audit log with before/after diffs.

---

## 🏛️ System Architecture: The 4 Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NEXT.JS 14 FRONTEND CLIENTS                           │
│     Admin Dashboard  │  Scrutiny Queue  │  Selection  │  Applicant Portal   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST / JWT Auth
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    LAYER 1: SCHEME CONFIGURATION ENGINE                     │
│  - JSON Schema Validation (Pydantic v2)                                     │
│  - JSONLogic Automated Eligibility Evaluator                                │
│  - Dynamic Document Format & Validity Definitions                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                    LAYER 2: AI & DOCUMENT SCRUTINY ENGINE                   │
│  - MinIO S3 Object Storage & Presigned URLs                                 │
│  - OCR Extraction Pipeline (Text / Image / PDF)                             │
│  - Multi-Reason Deficiency Classification & Auto-Transition Engine          │
├─────────────────────────────────────────────────────────────────────────────┤
│                    LAYER 3: WORKFLOW STATE MACHINE & RBAC                   │
│  - Deterministic Finite State Machine (Configurable Transitions)            │
│  - Role Guardrails (Super Admin / Scheme Admin / Scrutiny / Committee)      │
│  - Complete Immutable Audit Logging with Transition Details                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                    LAYER 4: POST-SELECTION MANAGEMENT                       │
│  - Multi-Tranche Disbursement Scheduling & PFMS/DBT Tracking                │
│  - Annual Renewal Cycles & Academic Progress Reviews                        │
│  - Executive Aggregate Statistics & Real-time Metrics API                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend API** | **FastAPI** (Python 3.11+), Pydantic v2, Uvicorn |
| **Persistence & ORM** | **PostgreSQL 16**, SQLAlchemy 2.0 (async/sync), Alembic Migrations |
| **Object Storage** | **MinIO** (S3-compatible document storage) |
| **AI / OCR** | **pytesseract / Tesseract OCR**, pdf2image, Pillow, ReportLab |
| **Frontend Framework** | **Next.js 14** (App Router), React 18, TypeScript |
| **Styling & UI** | **Tailwind CSS**, Radix UI primitives, **shadcn/ui**, Lucide Icons |
| **Data Fetching** | **SWR** (stale-while-revalidate client cache) |
| **Containerization** | **Docker**, Docker Compose (multi-stage builds) |

---

## 🚀 Quick Start & Installation

### Option 1: Docker Compose (Recommended)

1. Clone repository and set up environment:
   ```bash
   cp .env.example .env
   ```
2. Build and start all services (PostgreSQL, Backend API, MinIO, Frontend):
   ```bash
   docker compose up --build
   ```
3. Seed the demonstration dataset:
   ```bash
   docker compose exec backend python scripts/seed_demo.py
   ```
4. Access the platform:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **API Docs (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Backend Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Option 2: Local Development

#### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python scripts/seed_demo.py
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Demo Personas & Credentials

The seed script (`backend/scripts/seed_demo.py`) initializes standard personas for all lifecycle stages:

| Persona | Email | Password | Role & Purpose |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@scst.gov.in` | `admin123` | Shri Rajeshwar Verma — Executive oversight & full system control |
| **Scheme Admin** | `scheme.admin@scst.gov.in` | `scheme123` | Smt. Sunita Sharma — Policy director & scheme schema manager |
| **Scrutiny Officer** | `scrutiny@scst.gov.in` | `scrutiny123` | Dr. Alok Nath — Document scrutiny & deficiency flagging |
| **Selection Committee** | `selection@scst.gov.in` | `selection123` | Prof. H. R. Soren — Committee Chair (Scoring & Award approval) |

---

## 🎬 Demonstration Rehearsal Run-of-Show

For judging presentations and evaluation walkthroughs, follow the comprehensive script in:
👉 **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)**

It covers:
1. **Act 1: Configurability Proof**: Side-by-side contrast of NFST and NOS configs (*same engine, zero code changes*).
2. **Act 2: Scenario 1 (NFST Golden Path)**: End-to-end completed fellowship with verified OCR fields, committee resolution, and post-selection disbursements/renewals.
3. **Act 3: Scenario 2 (NOS Overseas Scholarship)**: International credentials, unconditional foreign admission offer, and overseas wire remittance.
4. **Act 4: Scenario 3 (Unhappy Path & Live Resubmission)**: Stacked deficiency reasons (`EXPIRED_DATE`, `FORMAT_INVALID`, `MISSING_FIELD`) → citizen view at `/apply/status/[id]` → live replacement upload with real-time transition out of `deficient`.
5. **Act 5: Scenario 4 (Automated Ineligibility)**: Evaluation matrix recording 3 simultaneously-failing rules in the transparent audit log.
6. **Act 6: Selection Committee Action**: 1-click committee approval on Tanvi Kamble unlocking post-selection.
7. **Act 7: Executive Dashboard Overview**: Aggregate overview metrics, visual distribution bars, and live activity feeds.

To verify all demonstration endpoints in automated fashion, run:
```bash
cd backend
python scripts/dry_run_test.py
```

---

## 📂 Repository Structure

```
scholarship-admin-platform/
├── backend/
│   ├── alembic/                # Database migrations
│   ├── app/
│   │   ├── api/                # REST endpoints (auth, schemes, applications, scrutiny, selection, disbursements, renewals, stats)
│   │   ├── core/               # App configuration, security, database sessions, RBAC deps
│   │   ├── fixtures/           # Declarative scheme configs (NFST, NOS)
│   │   ├── models/             # SQLAlchemy 2.0 ORM entities
│   │   ├── schemas/            # Pydantic v2 validation & response schemas
│   │   └── services/           # Workflow engine, OCR, field extraction, deficiency classifier, notifications
│   ├── scripts/
│   │   ├── seed_demo.py        # Safe, idempotent demo seed script
│   │   └── dry_run_test.py     # Automated run-of-show verification suite
│   ├── tests/                  # 140+ unit & integration tests
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── apply/              # Public citizen portal (intake, document upload, status & remediation)
│   │   ├── dashboard/          # Authenticated admin portal (overview, schemes, scrutiny, selection, post-selection, audit)
│   │   └── login/              # Unified authentication screen
│   ├── components/             # Reusable UI component library (shadcn/ui)
│   └── lib/                    # API client, auth context, TypeScript definitions
├── DEMO_SCRIPT.md              # Rehearsed 7-act demonstration script
├── docker-compose.yml          # Container orchestration specification
├── .env.example                # Environment template with non-sensitive defaults
├── .gitignore                  # Exclusion rules (secrets, databases, build artifacts)
└── README.md                   # Project overview & documentation
```

---

## ⚖️ License & Ethical Declaration

This project was built for the **Smart India Hackathon (SIH26238)**. All personal names, registration numbers, income certificates, and applicant details used in fixtures, seed scripts, and sample documents are 100% synthetic and generated exclusively for testing and demonstration purposes.
