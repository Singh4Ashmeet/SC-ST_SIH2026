# Yojana Setu — Test Suite & Verification Guide

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**Test Framework:** Pytest 8.3.3 (Backend) | Next.js 16 / TypeScript 5 (Frontend)

---

## 1. Test Architecture & Coverage Summary

The Yojana Setu test suite spans unit tests, negative security tests, IDOR/BOLA authorization tests, document OCR robustness tests, and full end-to-end integration workflows.

### Test Execution Summary:
- **Backend Test Cases:** **186 Tests**
- **Test Pass Rate:** **100% (186 / 186 Passed)**
- **Frontend Build Status:** **Passed (0 TypeScript / Compilation Errors)**
- **Corpus Benchmark:** **368 Synthetic Documents Verified**

---

## 2. Test Suite Breakdown

### A. Security & Object-Level Authorization (Anti-IDOR / Anti-BOLA)
**File:** `backend/tests/test_applicant_ownership_security.py`
- Tests that Applicant A cannot access Applicant B's application (`403 Forbidden`).
- Tests that unauthenticated requests to documents are rejected.
- Tests that non-officials cannot approve documents or advance workflows.
- Tests that grievance messages cannot be injected by third parties.

### B. Document Intelligence & OCR Normalization Robustness
**File:** `backend/tests/test_document_intelligence_robustness.py`, `backend/tests/test_ocr_extraction.py`
- Negative testing: Ensures "Office of the District Magistrate, Garhwa" extracts "Garhwa", not "Magistrate".
- Currency normalization: Correctly normalizes "₹3.8 Lakh" &rarr; 380,000 and "Rs. 2,50,000/-" &rarr; 250,000.
- Tribal category extraction across synonyms and Hindi text.

### C. Decision Passport & Uncertainty Routing
**File:** `backend/tests/test_decision_passport.py`
- Verifies end-to-end read-model aggregation across all 10 unified sections.
- Validates field-level confidence ratings and OCR region snippets.
- Enforces applicant ownership checks on passport endpoints.

### D. Government Integration Gateway
**File:** `backend/tests/test_integration_gateway.py`
- Validates DigiLocker Sandbox Adapter with valid and invalid/fake certificates.
- Validates API Setu State e-District gateway responses.
- Validates PFMS bank account IFSC checking and DBT NPCI Aadhaar-mapper seeding.

### E. Policy Impact Simulator
**File:** `backend/tests/test_policy_simulation.py`
- Verifies that running simulations operates in an isolated context without mutating live scheme policies.
- Validates financial budget calculations using configurable scheme grants.
- Tests the authorized `publish` lifecycle transition (`DRAFT` &rarr; `SIMULATED` &rarr; `PUBLISHED`).

### F. Communication Center
**File:** `backend/tests/test_notification_service.py`
- Tests template rendering across all notification categories.
- Tests multi-channel dispatch adapters (In-App, Email sandbox, SMS sandbox).

---

## 3. How to Execute Tests Locally

### Running Backend Pytest:
```bash
cd backend
# Run all newly added and upgraded test suites
python -m pytest -q tests/test_applicant_ownership_security.py tests/test_document_intelligence_robustness.py tests/test_decision_passport.py tests/test_integration_gateway.py tests/test_policy_simulation.py tests/test_notification_service.py

# Run full backend test suite
python -m pytest -q tests/
```

### Running Synthetic Document AI Benchmark:
```bash
cd backend
python scripts/run_document_benchmark.py
```

### Running Frontend Type-Check & Build:
```bash
cd frontend
npm run build
```
