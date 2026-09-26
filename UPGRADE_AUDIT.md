# 🏛️ YOJANA SETU — COMPREHENSIVE REPOSITORY UPGRADE AUDIT
**SIH Problem Statement SIH26239 | Ministry of Tribal Affairs (MoTA)**
**AI-Enabled Scholarship & Fellowship Management System for Scheduled Tribes**
**Date:** September 2026
**Role:** Senior Staff Engineer, Security Engineer, AI/Document-Intelligence Engineer, Product Architect

---

## 1. Executive Summary & Audit Mandate

This repository is **NOT** a greenfield project. It already contains a substantial and functioning foundation:
- Dynamic JSON-driven scheme configuration engine (NFST and NOS schemes)
- JSONLogic automated eligibility evaluation
- PyTesseract/PyMuPDF document OCR pipeline with basic deficiency detection
- Multi-tranche disbursement and renewal workflow
- Cross-scheme conflict detection engine
- Cryptographic hash-chained audit trail (SHA-256 tamper-evident chain)
- 157 passing backend tests and a Next.js 14 frontend that compiles cleanly

The goal of this upgrade is to transform Yojana Setu from a promising hackathon prototype into a **technically credible, government-grade, defensible platform** that directly fulfills all 24 MoTA problem requirements without pretending or fabricating capabilities.

The core design philosophy is:
> **AI assists. Rules decide according to approved configuration. Humans resolve uncertainty and exercise oversight. Every important decision is explainable. Every important event is auditable.**

---

## 2. Current Architecture Map

```
                                  YOJANA SETU PLATFORM
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
   APPLICANT PORTAL               ADMIN DASHBOARDS                  SECURITY & AUDIT
 (Intake, Status, Docs)      (Scrutiny, Merit, Schemes)         (RBAC, SHA-256 Hash Chain)
         │                                 │                                 │
         └─────────────────────────────────┼─────────────────────────────────┘
                                           │ REST API / JWT
                                           ▼
                            FASTAPI APPLICATION ENGINE
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ Layer 1: Scheme Configuration & JSONLogic Eligibility                                  │
 │   - SchemeConfigValidator (Pydantic v2 schemas: NFST, NOS)                             │
 │   - JSONLogic evaluator against applicant form fields                                  │
 ├────────────────────────────────────────────────────────────────────────────────────────┤
 │ Layer 2: Document Processing & Extraction                                              │
 │   - StorageService (MinIO S3 / Supabase Storage adapter)                               │
 │   - OCRService (PyTesseract, PyMuPDF)                                                  │
 │   - FieldExtractionService (Regex/heuristic field matchers)                            │
 │   - DocumentTrustEngine (Consistency signals, SequenceMatcher)                         │
 │   - DeficiencyService (MISSING_FIELD, FORMAT_INVALID, EXPIRED_DATE)                    │
 ├────────────────────────────────────────────────────────────────────────────────────────┤
 │ Layer 3: Lifecycle State Machine & RBAC                                                │
 │   - WorkflowEngine (Deterministic FSM with role guardrails)                            │
 │   - MeritEngine (Score computation, ranking, preference rules)                         │
 │   - ConflictEngine (Cross-scheme fuzzy match)                                          │
 │   - AuditService (Cryptographic previous_hash -> current_hash chain)                   │
 ├────────────────────────────────────────────────────────────────────────────────────────┤
 │ Layer 4: Post-Selection & Governance                                                   │
 │   - Disbursements & Renewals                                                           │
 │   - Grievance Engine with priority SLA calculation                                     │
 │   - PolicySimulationEngine (What-if eligibility & merit simulation)                    │
 └────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
                          POSTGRESQL 16 / SQLITE PERSISTENCE
```

---

## 3. Detailed Audit Findings (Categories A – J)

### A. What is Genuinely Implemented
1. **Dynamic Scheme Configuration**: JSON schema with Pydantic v2 validation (`backend/app/schemas/scheme_config.py`). Declarative definitions for NFST (domestic PhD) and NOS (international overseas) operate on the same engine.
2. **Automated Eligibility Engine**: JSONLogic evaluation against applicant data (`backend/app/services/eligibility_engine.py`).
3. **Workflow State Machine**: FSM enforcing valid state transitions with allowed roles (`backend/app/services/workflow_engine.py`).
4. **Document Scrutiny & Deficiency Detection**: Categorization of issues into missing fields, invalid formats, and expired certificates (`backend/app/services/deficiency_service.py`).
5. **Cryptographic Audit Trail**: SHA-256 chained hashing (`previous_hash` + payload -> `current_hash`), tamper simulation, and verification (`backend/app/services/audit_service.py`).
6. **Merit Scoring & Ranking**: Weighted scoring with preference rules (`backend/app/services/merit_engine.py`).
7. **Post-Selection Tracking**: Financial tranches, PFMS/DBT reference tracking, and annual academic renewal reviews (`backend/app/models/disbursement.py`, `backend/app/models/renewal.py`).
8. **Test Suite**: 157 passing tests covering core workflows, scheme validation, eligibility, and disbursements.
9. **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide icons, SWR client data fetching.

### B. What is Placeholder / Stubbed
1. **Notification Service (`notification_service.py`)**: Only logs string messages to Python logger (`"Would send email to..."`). Does not persist notifications, lacks email/SMS delivery adapters, delivery statuses, retry counts, correlation IDs, or communication history view.
2. **Government Integration Gateways**: Zero abstraction for DigiLocker, API Setu, PFMS, or DBT. Calls are ad-hoc or simulated without clean sandbox provider boundaries.
3. **Document Evidence Highlighting**: Extracted fields are shown as plain text without visual bounding boxes or source text-span references on documents.
4. **Decision Passport**: No unified explainable decision read model exists. The decision rationale is currently fragmented across applications, audit logs, and merit evaluations.

### C. What is Simulated
1. **Audit Tamper Simulation**: `simulate_tampering()` alters a record's action in the database and demonstrates that `verify_hash_chain()` detects the break.
2. **Policy Simulation**: `simulate_policy_change()` calculates what-if impact, but uses a hardcoded financial assumption (`₹372,000/yr`) and has no governance lifecycle (`DRAFT`, `SIMULATED`, `APPROVED`, `PUBLISHED`).

### D. What is Insecure
1. **Exposed Credentials in Source Code**:
   - `backend/app/core/config.py`: Hardcoded Supabase database connection string containing plaintext password, and fallback JWT secret.
   - `backend/.env`: Active Supabase database and MinIO credentials present in workspace files.
2. **Unauthenticated Applicant Endpoints (UUID-only reliance)**:
   - `GET /applications/{application_id}`: Permitted without authentication if no token provided.
   - `POST /applications/{application_id}/documents`: Unauthenticated document upload.
   - `GET /applications/documents/{document_id}/file`: Unauthenticated file download if token omitted.
   - `POST /applications/{application_id}/run-document-scrutiny`: Unauthenticated execution of scrutiny.
   - `POST /applications/{application_id}/documents/{document_id}/resubmit`: Unauthenticated document overwrite.
3. **IDOR / BOLA Vulnerabilities in Grievances**:
   - `GET /grievances`: Any logged-in user (including applicants) can see all grievances across the entire system.
   - `GET /grievances/{id}`: Any authenticated user can read any applicant's grievance.
4. **Privilege Escalation on Tamper Demonstration**:
   - `POST /audit-log/simulate-tamper` and `POST /audit-log/restore` use `require_any_role` instead of restricting to `SUPER_ADMIN`.
5. **Missing Object-Level Authorization**:
   - Role checks frequently test broad role names rather than fine-grained permissions.

### E. What is Hardcoded
1. `annual_fellowship_amount = 372000` in `policy_simulation_engine.py`.
2. Confidence numbers in `ocr_service.py` (`0.92 if text else 0.0`), `0.98`, `0.90`.
3. Document trust thresholds (`trust_score = 95 / 65 / 35`).
4. Hardcoded secrets in `config.py`.

### F. What is Misleadingly Named as "AI" but is Actually Heuristic
1. **OCR Service**: Named "Document AI / OCR Service", but is PyTesseract + PyMuPDF with regex.
2. **CustomModelOCRProvider**: Implements a mock class returning hardcoded `"Extracted via Custom OCR"` and `confidence: 0.98`, implying a custom deep learning model exists when it does not.
3. **Document Trust Engine**: Calculates a heuristic `trust_score` (95, 65, 35) based on string length and regex match counts.

### G. What Needs Database Migration / Schema Additions
1. **Decision Passport**: `DecisionPassport` read-model / aggregation schema.
2. **Field Evidence & Confidence**: Structured field evidence storage (`confidence`, `source_page`, `source_region`, `extraction_method`, `validation_status`).
3. **Review Routing**: Routing flag (`AUTO_VERIFY`, `HUMAN_REVIEW_RECOMMENDED`, `MANDATORY_HUMAN_REVIEW`) and threshold configs.
4. **Notification Entity**: `Notification` and `NotificationDelivery` tables for the Communication Center.
5. **Committee Integrity**: `CommitteeReview`, `CommitteeConflict`, member votes, quorum tracking, and declarations.
6. **Policy Simulation Governance**: Policy lifecycle status (`DRAFT`, `SIMULATED`, `APPROVED`, `PUBLISHED`).
7. **Verification Gateway**: Records for external sandbox verifications (`DigiLockerSandbox`, `APISetuSandbox`, `PFMSSandbox`).

### H. What Needs Frontend Work
1. **Decision Passport Screen**: Explainable, single-pane-of-glass decision passport answering "Why did this application receive this decision?".
2. **Evidence Viewer**: Side-by-side or highlighted evidence inspector displaying exact extracted field vs certificate source.
3. **Uncertainty-Aware Review Queue**: Visual badges distinguishing auto-verified from review-required applications.
4. **Policy Impact Simulator**: Dynamic sliders/inputs without hardcoded financials, showing real diff and workload projection.
5. **Communication Center**: In-app notifications tray, SMS/email sandbox dispatch logs.
6. **Committee Integrity Review**: Quorum indicators, conflict-of-interest declarations, vote tallies.
7. **Applicant Assisted Mode**: Step-by-step low-bandwidth bilingual (English / Hindi) guided application view.
8. **Real-time Status Updates**: Polling / near-real-time updates without full page reloads.

### I. What Needs Backend Work
1. **Security**: Centralized ownership & authorization helpers; remove hardcoded credentials; enforce strict auth on all applicant routes; protect tamper simulation.
2. **Document Intelligence Provider Abstraction**: `DocumentIntelligenceProvider` interface with `TesseractDocumentProvider`, `MockDocumentProvider`, honest metrics.
3. **Extraction Normalization**: Robust Indian number format, dates, districts, authorities, unicode cleanup, negative tests.
4. **Decision Passport Service**: Aggregation read-model combining application data, document evidence, merit score, committee reviews, and audit events.
5. **Uncertainty-Aware Routing Engine**: Configurable thresholds (`>= 0.90` auto-verify, `0.70-0.89` recommended, `< 0.70` mandatory).
6. **Communication Center**: In-app, sandbox email, and sandbox SMS adapters with persistent delivery history.
7. **Committee Integrity Layer**: Quorum verification, conflict blocking, vote aggregation.
8. **Policy Simulation Upgrade**: Dynamic financial calculations based on scheme configuration, isolated sandbox, state transitions.
9. **Government Integration Gateway**: `VerificationGateway` with mock sandbox adapters for DigiLocker, API Setu, PFMS, and DBT.

### J. What Needs Tests
- IDOR / BOLA authorization tests (Applicant A vs Applicant B).
- Security tests for unauthenticated access attempts on applicant routes.
- Tamper simulation role restriction tests.
- Document intelligence provider & normalization negative tests (e.g. "District Magistrate, Garhwa" not extracting "Magistrate").
- Decision Passport aggregation tests.
- Committee integrity & conflict blocking tests.
- Policy simulation dynamic financial calculations & publication isolation tests.
- Communication Center delivery history tests.
- Integration sandbox gateway tests.

---

## 4. Proposed Upgrades & Architecture

### Target System Flow:
```
DOCUMENT UPLOAD
      │
      ▼
VALIDATION & QUALITY CHECK
      │
      ▼
DOCUMENT INTELLIGENCE PROVIDER (Tesseract / Mock Sandbox)
      │
      ▼
FIELD EXTRACTION & ROBUST NORMALIZATION
      │
      ▼
FIELD & DOCUMENT LEVEL CONFIDENCE COMPUTATION
      │
      ▼
CROSS-DOCUMENT CONSISTENCY & EVIDENCE GRAPH
      │
      ▼
UNCERTAINTY-BASED ROUTING (Auto-Verify vs Human Review)
      │
      ▼
ELIGIBILITY / MERIT RULES (JSONLogic)
      │
      ▼
COMMITTEE GOVERNANCE & CONFLICT CHECK (Quorum, Voting)
      │
      ▼
DECISION PASSPORT GENERATION (Explainable Snapshot)
      │
      ▼
TAMPER-EVIDENT AUDIT TRAIL (SHA-256 Chain)
      │
      ▼
COMMUNICATION CENTER (In-App / Email / SMS Sandbox)
```

---

## 5. Implementation Roadmap & Execution Plan

| Phase | Domain | Action Items |
| :--- | :--- | :--- |
| **Phase 1** | **Security Hardening** | Cleanse credentials from `config.py` & `.env`; enforce authentication & ownership on all application/document endpoints; fix IDOR in grievances; restrict tamper simulation to `SUPER_ADMIN`; add explicit permissions. |
| **Phase 2** | **Document Intelligence** | Implement `DocumentIntelligenceProvider` interface (`TesseractDocumentProvider`, `MockDocumentProvider`); remove fake AI claims; implement real field/document confidence calculations; build robust normalization helpers (Indian dates, currency, districts, authorities). |
| **Phase 3** | **Decision Passport** | Build `DecisionPassport` aggregation backend model and API; generate unified explainable snapshot (Eligibility, Evidence, Confidence, Deficiencies, Merit, Human Oversight, Audit link). |
| **Phase 4** | **Evidence Visualization** | Connect field evidence to source documents; enhance evidence graph API; build UI for clickable evidence nodes and source text-span inspection. |
| **Phase 5** | **Uncertainty-Aware Review** | Implement confidence routing (`AUTO_VERIFY`, `HUMAN_REVIEW_RECOMMENDED`, `MANDATORY_HUMAN_REVIEW`); integrate thresholds into scheme config; provide scrutiny queue filters. |
| **Phase 6** | **Communication Center** | Implement persistent `Notification` models, `CommunicationCenter` service, and mock sandbox adapters (In-App, Email, SMS); provide communication history API. |
| **Phase 7** | **Committee & Conflict Integrity** | Implement committee quorum checks, conflict-of-interest declarations, vote tallies, and review blocking; link resolution to audit events. |
| **Phase 8** | **Policy Impact Simulator** | Remove hardcoded financial assumptions (`₹372,000`); source values from scheme config; implement isolated policy lifecycle (`DRAFT`, `SIMULATED`, `APPROVED`, `PUBLISHED`); build side-by-side diff UI. |
| **Phase 9** | **Applicant Assisted Mode & Near-Real-Time**| Build low-bandwidth bilingual (English/Hindi) assisted intake mode; implement near-real-time polling/SSE status refreshes. |
| **Phase 10** | **Government Integration Gateway** | Implement `VerificationGateway` with labeled sandbox adapters for DigiLocker, API Setu, PFMS, and DBT. |
| **Phase 11** | **Corpus Benchmark & Testing** | Run benchmark against all 368 synthetic documents; generate `/docs/DOCUMENT_AI_BENCHMARK.md`; add comprehensive security and negative tests. |
| **Phase 12** | **Documentation & SIH Reports** | Produce updated README, `/docs/ARCHITECTURE.md`, `/docs/SECURITY.md`, `/docs/DECISION_PASSPORT.md`, `/IMPLEMENTATION_REPORT.md`, `/SIH_READINESS.md`. |

---
*End of Upgrade Audit Document. Approved for Phase-by-Phase Execution.*
