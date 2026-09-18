# Scholarship Admin Platform

A full-stack admin platform for managing scholarship and fellowship schemes end-to-end — from application intake and eligibility verification, through document scrutiny and selection committees, to post-selection tracking and disbursement. The stack uses **FastAPI** (Python) for the backend API, **Next.js 14** (TypeScript, App Router) for the frontend, and **PostgreSQL 16** for persistence, all orchestrated with Docker Compose for zero-friction local development.

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> scholarship-admin-platform
cd scholarship-admin-platform

# 2. Copy the example env file (edit values if needed)
cp .env.example .env

# 3. Bring up all three services (Postgres, Backend, Frontend)
docker compose up --build

# 4. Open the app
#    Frontend  → http://localhost:3000
#    Backend   → http://localhost:8000/docs  (Swagger UI)
#    Health    → http://localhost:8000/health
```

The frontend home page will automatically call the backend's `/health` endpoint and display the database connection status — confirming that all three services are talking to each other.

## Project Structure

```
scholarship-admin-platform/
├── backend/           # FastAPI + SQLAlchemy + Alembic
├── frontend/          # Next.js 14 (App Router, TypeScript, Tailwind, shadcn/ui)
├── docker-compose.yml
├── .env.example
└── README.md
```
