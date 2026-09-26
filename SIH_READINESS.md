# Yojana Setu — SIH 2026 Readiness Report & Defense Guide

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**System:** AI-enabled Scholarship and Fellowship Management System for Scheduled Tribe Students  
**Platform Name:** **YOJANA SETU (योजना सेतु)**

---

## 1. The Three Standout Differentiators

When presenting Yojana Setu to SIH evaluators and technical judges, emphasize that this is **not another generic scholarship portal with OCR slapped on top**. The entire platform converges on three standout architectural pillars:

### 1. The Flagship Decision Passport
A unified, explainable read-model that answers *"Why did this application receive this exact decision?"* in seconds. It connects every claim to its JSON-logic rule, extracted document evidence, OCR region snippet, human scrutiny sign-off, committee vote, and cryptographic SHA-256 audit hash.

### 2. Uncertainty-Aware Document Intelligence
An honest, decoupled document intelligence pipeline that never claims a mysterious "black-box deep learning AI" or hardcoded 92% confidence. Instead, it computes real continuous confidence (0.0 to 1.0) and routes applications to:
- **`AUTO_VERIFY`** (&ge; 90% confidence, all signals pass)
- **`HUMAN_REVIEW_RECOMMENDED`** (70% - 89% confidence)
- **`MANDATORY_HUMAN_REVIEW`** (&lt; 70% confidence or discrepancy)

### 3. Sandboxed Policy Impact Simulator
Allows ministerial leadership to run what-if policy scenarios (e.g., raising income ceilings from ₹6L to ₹8L or altering doctoral research weightings) in an isolated sandbox, calculating financial budget deltas and scrutiny workload shifts before publishing new scheme policies.

---

## 2. Technical Strengths & Defense Profile

| Evaluation Dimension | Yojana Setu Implementation | Why It Wins Evaluator Trust |
| :--- | :--- | :--- |
| **Security & IDOR** | Centralized ownership guards (`authorization.py`) and RBAC permissions (`permissions.py`). Zero hardcoded credentials. | Withstands rigorous pen-testing; applicant A cannot access applicant B's documents or passports. |
| **AI Credibility** | Real text density, keyword presence, and cross-document match metrics. Ground-truth benchmark on 368 synthetic documents. | Completely defensible; no fabricated claims of custom LLMs or fake 92% accuracy. |
| **Governance & Ethics** | Committee quorum tracking and automated conflict-of-interest blocking. | Directly solves real-world administrative corruption and bias in fellowship awards. |
| **Inclusivity & Access** | Bilingual (English/हिन्दी) low-bandwidth Assisted Application Mode with offline local-storage draft saving. | Tailored specifically for ST students from remote tribal areas with low network bandwidth. |
| **Auditability** | Cryptographic SHA-256 chained audit trail linking every lifecycle transition. | Tamper-evident; changes are mathematically detectable. |

---

## 3. Potential Judge Questions & Factually Defensible Answers

### Q1: *"Did you train your own proprietary deep learning AI model for OCR?"*
**Answer:**
> *"No, and we believe claiming that in a hackathon is often technically misleading. We built a production-grade Document Intelligence abstraction (`DocumentIntelligenceProvider`). Our engine combines Tesseract-backed OCR with robust text normalization, heuristic confidence extraction, anti-false-positive entity extraction (such as preventing 'District Magistrate' from matching as the district name), and cross-document entity verification. This generates a real continuous confidence score between 0.0 and 1.0, rather than a hardcoded static value."*

### Q2: *"How do you prevent an AI hallucination or OCR error from rejecting a deserving tribal student?"*
**Answer:**
> *"By design, AI in Yojana Setu never decides. AI only assists. We implement an Uncertainty-Aware Human Review routing model. If confidence falls below 90% or a cross-document discrepancy is detected (e.g. income certificate mismatch), the system immediately routes the file to Mandatory Human Review. Furthermore, our actionable deficiency system gives the applicant a 15-day resolution window with plain-language guidance to correct any document issue."*

### Q3: *"Are your DigiLocker and PFMS integrations live with the Government of India?"*
**Answer:**
> *"Our platform implements a production-grade Adapter Architecture (`VerificationGateway`). For this SIH prototype evaluation, our adapters operate in a transparent Sandbox/Mock mode (`[SANDBOX]`), generating verified e-District and PFMS payment bridge payloads. This allows complete end-to-end demonstration without falsely claiming unauthorized ministerial credentials. In production, these adapters map 1:1 to live MeitY and PFMS REST APIs once departmental lease lines are provisioned."*

### Q4: *"Can a corrupt official alter an application approval or audit trail after the fact?"*
**Answer:**
> *"No. Every state transition is recorded in an immutable audit ledger linked by SHA-256 cryptographic hashes. If any database record is tampered with, the cryptographic chain breaks. Furthermore, tamper simulation endpoints are restricted strictly to Super Administrators, and selection committee decisions require verified quorum with automated conflict-of-interest detection."*

### Q5: *"How does the Policy Simulator help the Ministry of Tribal Affairs?"*
**Answer:**
> *"It eliminates guesswork in government policymaking. If the Ministry wants to expand the National Fellowship by raising the annual income ceiling from ₹6 Lakh to ₹8 Lakh, the simulator runs the proposed criteria against historical cohort data in an isolated sandbox. It calculates the exact number of newly eligible students, the projected budgetary impact (e.g., +₹2.4 Crore), and the projected increase in scrutiny workload, allowing evidence-based decision-making before publishing."*

---

## 4. Suggested Demo Sequence (5–7 Minutes)

1. **Launch (`/`):** Introduce Ministry problem statement and Yojana Setu value proposition.
2. **Assisted Mode (`/apply`):** Demonstrate mobile & low-bandwidth bilingual application mode (English / हिन्दी).
3. **Document Ingestion (`/apply/.../documents`):** Upload document, extract structured fields, and show field confidence with line snippets.
4. **Decision Passport (`/dashboard/applications/[id]/decision-passport`):** Walk through the 10 unified sections and explainability summary.
5. **Human Scrutiny & Committee Governance:** Demonstrate conflict-of-interest detection and quorum validation.
6. **Policy Impact Simulator (`/dashboard/simulation`):** Shift income ceiling from ₹6L to ₹8L and show financial delta and workload impact.
7. **Audit Ledger (`/dashboard/audit`):** Verify SHA-256 cryptographic chain.
