# Yojana Setu — System Architecture & Design Specification

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**System:** AI-enabled Scholarship and Fellowship Management System for Scheduled Tribe Students  
**Platform Name:** **YOJANA SETU (योजना सेतु)**

---

## 1. Core Value Proposition

> **"Yojana Setu is an evidence-backed, configurable, and auditable scholarship decision platform that automates routine verification while keeping humans in control of consequential decisions."**

### Foundational Principles
1. **AI assists:** AI accelerates document extraction, text normalization, and inconsistency detection. It never acts as an unquestionable judge.
2. **Rules decide:** Declarative, versioned policy configurations approved by ministerial administrators determine eligibility and merit criteria.
3. **Humans resolve uncertainty:** Low-confidence documents, conflicting claims, and discretionary fellowship rankings are routed to designated scrutiny officers and selection committees.
4. **Every decision is explainable:** Through the **Decision Passport**, every outcome can be traced back to its supporting rule, document evidence, OCR region snippet, human sign-off, and cryptographic audit record.
5. **Every event is auditable:** An immutable, SHA-256 chained audit trail guarantees end-to-end accountability.

---

## 2. End-to-End Conceptual Flow

```text
                        DOCUMENT UPLOAD (Applicant / Assisted Mode)
                                           │
                                           ▼
                    DOCUMENT INTELLIGENCE PROVIDER (Tesseract / Vision)
                                           │
                                           ▼
               STRUCTURED FIELD EXTRACTION & CONTINUOUS CONFIDENCE (0.0 - 1.0)
                                           │
                                           ▼
                  CROSS-DOCUMENT VALIDATION & EVIDENCE GRAPH BUILDER
                                           │
                                           ▼
                    GOVERNMENT INTEGRATION GATEWAY (DigiLocker / PFMS)
                                           │
                                           ▼
                     DECLARATIVE SCHEME ELIGIBILITY & MERIT ENGINE
                                           │
                                           ▼
                     UNCERTAINTY-AWARE REVIEW ROUTING MODEL
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
       High (≥ 90%)                 Medium (70%-89%)              Low (< 70% / Mismatch)
       AUTO-VERIFY                  REVIEW RECOMMENDED            MANDATORY HUMAN REVIEW
             │                             │                             │
             └─────────────────────────────┼─────────────────────────────┘
                                           ▼
                               HUMAN SCRUTINY OVERSIGHT
                                           │
                                           ▼
                           SELECTION COMMITTEE GOVERNANCE
                         (Quorum Verification & Conflict Check)
                                           │
                                           ▼
                                   DECISION PASSPORT
                               (Unified Explainable Read-Model)
                                           │
                                           ▼
                                 SHA-256 AUDIT LOGGING
                                           │
                       ┌───────────────────┴───────────────────┐
                       ▼                                       ▼
             COMMUNICATION CENTER                      POST-SELECTION
       (In-App / Email / SMS Alerts)               (PFMS Disbursement & Renewal)
```

---

## 3. Subsystem Architecture

### 3.1 Policy & Scheme Engine
- **Declarative Schemes:** Schemes like National Fellowship for ST Students (NFST) and National Overseas Scholarship (NOS) are configured as versioned JSON documents without hardcoded rules.
- **JSON-Logic Engine:** Pure functional evaluation of applicant data against nested criteria (income caps, age limits, academic cutoffs, tribal categories).
- **Schema Validation:** Strict Pydantic models validate scheme structures before activation to prevent broken runtime states.

### 3.2 Document Intelligence Subsystem
- **Provider Abstraction:** Implements `DocumentIntelligenceProvider` interface with clean separation between `TesseractDocumentProvider`, `MockDocumentProvider`, and future vision/LLM providers.
- **Rich Field Extraction:** Every extracted field returns value, numerical confidence, confidence label, source page, line text snippet, and validation status.
- **Normalization:** Currency strings (Lakhs, Crores, commas) are parsed to numeric values. District names are disambiguated from administrative titles (e.g., "District Magistrate" vs actual district name).

### 3.3 Decision Passport
- **Consolidated Read Model:** Aggregates Application Summary, Eligibility Rules Breakdown, Document Evidence with region snippets, AI Confidence, Deficiencies, Merit Calculation, Human Reviews, Committee Governance, Financial/Disbursement Status, and Cryptographic Audit Signatures.
- **Instant Explainability:** Enables applicants and officers to answer *"Why did this application receive this decision?"* in seconds.

### 3.4 Committee Integrity & Conflict Governance
- **Quorum Enforcement:** Enforces minimum participating member requirements before fellowship selection decisions are finalized.
- **Conflict of Interest Detection:** Automatically halts review if a reviewer shares an institutional or direct affiliation with the applicant, logging conflict declarations and resolution events.

### 3.5 Policy Impact Simulator
- **Isolated Sandbox:** Allows policymakers to test proposed criteria changes (e.g. raising income ceiling from ₹6L to ₹8L, altering merit weighting) on historical applicant cohorts.
- **Non-Mutating Execution:** Simulations execute in a draft state and cannot alter production schemes until an authorized `publish` command is committed.
- **Financial & Workload Forecasting:** Calculates budgetary delta and expected scrutiny workload variations.

### 3.6 Government Integration Gateway
- **Transparent Sandbox Adapters:** Clean adapter architecture supporting DigiLocker, API Setu, PFMS, and DBT Bharat.
- **Honest Provenance:** Explicitly labels data provenance as `[SANDBOX]` in demonstration environments to maintain technical credibility.

### 3.7 Communication Center
- **Multi-Channel Dispatch:** Centralized event-driven notification hub supporting In-App alerts, Email sandbox, and SMS sandbox.
- **Traceable History:** Correlates notifications with specific applications and deficiency resolution workflows.
