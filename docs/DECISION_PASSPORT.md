# Yojana Setu — Decision Passport Specification

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**Feature:** Flagship Explainable Decision Passport  
**Service:** `app/services/decision_passport_service.py`  
**Endpoint:** `GET /api/applications/{application_id}/decision-passport`

---

## 1. Executive Purpose

The **Decision Passport** is Yojana Setu's flagship explainability feature. In conventional government portals, applicants receive opaque status messages such as *"Application Rejected"* or *"Ineligible"*, requiring prolonged RTI inquiries or grievances.

The Decision Passport provides an **authoritative, tamper-evident, unified snapshot** that answers:
> **"Why did this application receive this exact decision?"**
within seconds.

---

## 2. Read-Model Architecture

The Decision Passport is constructed as an **isolated aggregation read-model** that queries source-of-truth tables without duplicating or mutating operational data:

```text
Application + Scheme Config
         │
         ├─► 1. Application Summary & Responsible Officer Status
         ├─► 2. Rule-by-rule Eligibility Breakdown (JSON-Logic mapped to extracted evidence)
         ├─► 3. Document Evidence (Field-level confidence + OCR line snippets)
         ├─► 4. AI & Document Intelligence (Continuous confidence + Uncertainty routing)
         ├─► 5. Actionable Deficiencies (Itemized issues + resolution window)
         ├─► 6. Merit Calculation (Formula weighting + academic/research scores)
         ├─► 7. Human Scrutiny Sign-Off (Officer remarks + checklist verification)
         ├─► 8. Selection Committee Governance (Quorum verification + conflict audits)
         ├─► 9. Financial & PFMS Disbursement (DBT readiness + installment tracker)
         ├─► 10. Government Integration Gateway (DigiLocker & API Setu sandbox status)
         └─► 11. Cryptographic SHA-256 Chained Audit Passport
```

---

## 3. The 10 Unified Sections

### 1. Application Summary
- Unique Case Reference Number (e.g. `YS-NFST-00421`)
- Scheme Code & Full Title
- State / District of Residence
- Current Responsible Role (e.g. `SCRUTINY_OFFICER`, `COMMITTEE_MEMBER`)
- Consolidated Status Badge (`APPROVED`, `DEFICIENT`, `REVIEW_REQUIRED`, `REJECTED`, `PENDING`)

### 2. Eligibility Breakdown
- Evaluates each scheme rule declared in the scheme policy.
- Displays:
  - Rule identifier & target field
  - Declared applicant value
  - Extracted document evidence value
  - Evidentiary match status (`MATCH` / `MISMATCH`)
  - Evaluated condition result (`PASS` / `FAIL`)

### 3. Document Evidence with OCR Snippets
- Lists all uploaded certificates (Caste, Income, Admission, Marksheet).
- Displays extracted fields with individual numerical confidence scores (e.g. `96%`).
- Displays **OCR Region Snippets** linking claims directly to document text spans.

### 4. AI Confidence & Uncertainty Routing
- Continuous trust score (0–100%) computed from signal completeness, average field confidence, and OCR text density.
- Operational Routing Model:
  - **`AUTO_VERIFY`** (&ge; 90% confidence, all signals pass)
  - **`HUMAN_REVIEW_RECOMMENDED`** (70% - 89% confidence)
  - **`MANDATORY_HUMAN_REVIEW`** (&lt; 70% confidence or critical discrepancy)

### 5. Actionable Deficiencies
- Itemizes active deficiencies with plain-language explanations.
- Outlines exact required document formats, regulatory reasons, and resolution deadlines.

### 6. Merit Scoring Breakdown
- Composite merit score computed from qualifying academic degree marks and research publications.
- Category-level percentile and rank calculation.

### 7. Human Oversight Sign-Off
- Records human scrutiny officer assigned, scrutiny stage timestamps, checklist answers, and official remarks.

### 8. Selection Committee Integrity
- Tracks committee members, quorum requirements, individual votes/scores, and recorded conflict-of-interest checks.

### 9. Financial & PFMS Status
- Tracks bank account validation, IFSC verification, DBT NPCI mapper status, and installment disbursement schedule.

### 10. Cryptographic Audit Chain
- References the latest SHA-256 chained audit hash, confirming that every lifecycle event has been cryptographically signed.
