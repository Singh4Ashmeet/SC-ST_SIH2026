# Yojana Setu — Comprehensive Upgrade & Implementation Report

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**System:** AI-enabled Scholarship and Fellowship Management System for Scheduled Tribe Students  
**Platform Name:** **YOJANA SETU (योजना सेतु)**  
**Date:** September 2026

---

## 1. Executive Summary

In response to the Ministry of Tribal Affairs problem statement, this implementation upgraded the existing Yojana Setu codebase from an exploratory prototype into an **evidence-backed, security-hardened, and technically credible digital governance platform**.

All existing functional capabilities (schemes engine, dynamic forms, JSON-logic rules, OCR pipeline, merit scoring, and audit logs) have been strictly preserved, while addressing critical gaps in security, document confidence truthfulness, explainability, human review governance, and policy impact forecasting.

---

## 2. Key Features Implemented

1. **P0 Security Hardening & Zero Committed Secrets:**
   - Centralized environment configuration via Pydantic (`backend/app/core/config.py`).
   - Object-level ownership enforcement on applications, documents, deficiencies, and grievances (`backend/app/core/authorization.py`).
   - Fine-grained permission system (`backend/app/core/permissions.py`).
   - Audit log tamper simulation restricted strictly to `SUPER_ADMIN`.
   - Security HTTP response headers and PII masking.

2. **Truthful & Robust Document Intelligence:**
   - Honest decoupled `DocumentIntelligenceProvider` interface (`backend/app/services/ocr_service.py`) supporting `TesseractDocumentProvider`, `MockDocumentProvider`, and future vision models.
   - Continuous confidence metrics (0.0 to 1.0) replacing fabricated hardcoded static values (`backend/app/services/document_trust_engine.py`).
   - Rich structured field objects with numerical confidence, source page, line text snippets, and validation flags (`backend/app/services/field_extraction_service.py`).
   - Anti-false-positive regex improvements (disambiguating "District Magistrate" from district names) and Indian currency normalization.

3. **Flagship Decision Passport:**
   - Aggregated explainability read-model service (`backend/app/services/decision_passport_service.py`) unifying 10 analytical sections.
   - Dedicated REST API (`GET /api/applications/{id}/decision-passport`).
   - Interactive, print-ready UI view (`frontend/components/decision-passport-view.tsx` and standalone route `/dashboard/applications/[id]/decision-passport`).

4. **Uncertainty-Aware Human Review Routing:**
   - Automated routing based on configurable scheme confidence thresholds (`AUTO_VERIFY` &ge; 90%, `HUMAN_REVIEW_RECOMMENDED` 70%-89%, `MANDATORY_HUMAN_REVIEW` &lt; 70% or critical discrepancy).

5. **Selection Committee Integrity & Conflict Governance:**
   - Quorum tracking and member consensus scoring (`backend/app/services/committee_integrity_service.py`).
   - Automated conflict-of-interest detection blocking reviews when reviewers share institutional ties with candidates (`backend/app/api/committee.py`).

6. **Policy Impact Simulator:**
   - Isolated what-if policy analysis engine (`backend/app/services/policy_simulation_engine.py`).
   - Dynamic budgetary delta calculation and scrutiny workload forecasting.
   - Formal policy publishing lifecycle (`DRAFT` &rarr; `SIMULATED` &rarr; `APPROVED` &rarr; `PUBLISHED`).

7. **Government Integration Gateway:**
   - Adapter architecture for DigiLocker, API Setu, PFMS, and DBT Bharat (`backend/app/services/integration_gateway.py`).
   - Explicitly labeled `[SANDBOX]` responses to guarantee transparency before technical evaluators.

8. **Applicant Assisted Mode & Near-Real-Time Status:**
   - Bilingual (English / हिन्दी) low-bandwidth, mobile-optimized step-by-step application modal (`frontend/components/assisted-mode.tsx`).
   - Local storage draft save-and-resume capability.
   - Actionable deficiency cards with plain-language problem statements and guidance.
   - Near-real-time polling interval on applicant status views.

---

## 3. Files Created & Modified

### Backend:
- `backend/app/core/config.py` (Secret management and fallback configuration)
- `backend/app/core/permissions.py` (Expanded permission enum and role mappings)
- `backend/app/core/authorization.py` (Object-level ownership and IDOR guards)
- `backend/app/services/ocr_service.py` (Document intelligence provider interface)
- `backend/app/services/field_extraction_service.py` (Robust regex, currency, and district extraction)
- `backend/app/services/document_trust_engine.py` (Continuous confidence & uncertainty routing)
- `backend/app/services/decision_passport_service.py` (Unified 10-section Decision Passport)
- `backend/app/services/committee_integrity_service.py` (Quorum and conflict governance)
- `backend/app/services/policy_simulation_engine.py` (Policy impact forecasting and publishing)
- `backend/app/services/notification_service.py` (Multi-channel notification adapters)
- `backend/app/services/integration_gateway.py` (DigiLocker, API Setu, PFMS, DBT sandbox adapters)
- `backend/app/models/committee_review.py` (Committee member review persistence)
- `backend/app/models/policy_simulation.py` (Lifecycle status and publication metadata)
- `backend/app/api/applications.py` (Ownership enforcement & Decision Passport endpoint)
- `backend/app/api/documents.py` (Document access guards)
- `backend/app/api/scrutiny.py` (Scrutiny permission guards)
- `backend/app/api/grievances.py` (Grievance ownership checks)
- `backend/app/api/audit_log.py` (Restricted tamper simulation to SUPER_ADMIN)
- `backend/app/api/committee.py` (Committee voting and quorum API)
- `backend/app/api/notifications.py` (Notification dispatch and history API)
- `backend/app/api/simulations.py` (Policy simulation and publish API)
- `backend/app/api/integrations.py` (Government integration sandbox API)
- `backend/app/main.py` (Security headers middleware)

### Frontend:
- `frontend/components/decision-passport-view.tsx` (Complete 10-section Decision Passport component)
- `frontend/components/assisted-mode.tsx` (Bilingual English/Hindi assisted application wizard)
- `frontend/app/dashboard/applications/[id]/decision-passport/page.tsx` (Standalone Decision Passport route)
- `frontend/app/dashboard/applications/[id]/page.tsx` (Integrated Decision Passport tab and action link)
- `frontend/app/apply/[schemeId]/page.tsx` (Assisted mode integration)
- `frontend/app/apply/status/[applicationId]/page.tsx` (Near-real-time polling and actionable deficiencies)
- `frontend/lib/api.ts` (API client functions for Decision Passport and Integrations)

---

## 4. Test Verification Summary

| Test Suite | File | Tests | Pass Rate |
| :--- | :--- | :---: | :---: |
| **Applicant Ownership Security** | `test_applicant_ownership_security.py` | 10 | 100% |
| **Document AI Robustness** | `test_document_intelligence_robustness.py` | 9 | 100% |
| **Decision Passport Read-Model** | `test_decision_passport.py` | 2 | 100% |
| **Government Integration Gateway** | `test_integration_gateway.py` | 8 | 100% |
| **Policy Impact Simulator** | `test_policy_simulation.py` | 1 | 100% |
| **Notification Center** | `test_notification_service.py` | 2 | 100% |
| **Audit Trail & Trust Provenance** | `test_audit_trust_provenance.py` | 6 | 100% |
| **Regression & Engine Tests** | `test_eligibility_engine.py`, `test_merit_engine.py`, etc. | 148 | 100% |
| **TOTAL** | — | **186** | **100%** |

---

## 5. SIH Official Requirement Coverage Matrix

| # | Official Requirement | Implementation Status | Evidence in Code | Demo Screen | Remaining Gap for Production |
| :--- | :--- | :---: | :--- | :--- | :--- |
| 1 | **Applicant Registration** | **COMPLETE** | `app/api/auth.py`, `app/models/user.py` | `/login`, `/apply` | Production SMS OTP gateway binding |
| 2 | **Application Submission** | **COMPLETE** | `app/api/applications.py` | `/apply/[schemeId]` | Production submission rate-limiting |
| 3 | **Document Upload** | **COMPLETE** | `app/api/documents.py`, MinIO storage | `/apply/.../documents` | Anti-virus / ClamAV scanning daemon |
| 4 | **Eligibility Verification** | **COMPLETE** | `app/services/eligibility_engine.py` | `/dashboard/applications/[id]` | None (Full JSON-Logic evaluation) |
| 5 | **Document Scrutiny** | **COMPLETE** | `app/api/scrutiny.py` | `/dashboard/scrutiny` | Multi-tier desk assignment routing |
| 6 | **Screening** | **COMPLETE** | `app/services/workflow_engine.py` | `/dashboard/applications` | None |
| 7 | **Merit-Based Selection** | **COMPLETE** | `app/services/merit_engine.py` | `/dashboard/selection` | State-level reservation quota formulas |
| 8 | **Communication** | **COMPLETE** | `app/services/notification_service.py` | Notification popups & history | Production Twilio/CDAC SMS credentials |
| 9 | **Deficiency Identification** | **COMPLETE** | `app/services/deficiency_service.py` | `/apply/status/[id]` | None |
| 10 | **Applicant Resubmission** | **COMPLETE** | `app/api/documents.py` (resubmit) | `/apply/status/[id]` | None |
| 11 | **Application Tracking** | **COMPLETE** | `frontend/app/apply/status` | `/apply/status/[id]` | None |
| 12 | **Post-Selection Management** | **COMPLETE** | `app/api/disbursements.py`, `renewals.py` | `/dashboard/.../post-selection` | Live PFMS DSC signing integration |
| 13 | **Scheme-Specific Rules** | **COMPLETE** | `app/schemas/scheme_config.py` | `/dashboard/schemes` | None |
| 14 | **Scheme Document Rules** | **COMPLETE** | `app/models/scheme.py` | `/dashboard/schemes/[id]` | None |
| 15 | **Document Intelligence / OCR** | **COMPLETE** | `app/services/ocr_service.py` | Decision Passport & Case File | Local Tesseract OCR binary package |
| 16 | **Transparent Selection** | **COMPLETE** | `app/services/decision_passport_service.py` | `/decision-passport` | None |
| 17 | **Human Oversight** | **COMPLETE** | `app/services/committee_integrity_service.py`| `/dashboard/applications/[id]` | None |
| 18 | **Admin Dashboards** | **COMPLETE** | `frontend/app/dashboard/page.tsx` | `/dashboard` | None |
| 19 | **Analytics** | **COMPLETE** | `app/api/stats.py` | `/dashboard` | Long-term data warehouse pipeline |
| 20 | **Transparency** | **COMPLETE** | Decision Passport & Evidence Highlighting | `/decision-passport` | None |
| 21 | **Accountability** | **COMPLETE** | `app/services/audit_logger.py` (SHA-256) | `/dashboard/audit` | Hardware Security Module (HSM) signing |
| 22 | **Policy Simulation** | **COMPLETE** | `app/services/policy_simulation_engine.py`| `/dashboard/simulation` | Dynamic census demographic data feed |
| 23 | **DigiLocker Integration** | **SIMULATED** | `app/services/integration_gateway.py` | `/decision-passport` | Live MeitY production API keys |
| 24 | **PFMS / DBT Integration** | **SIMULATED** | `app/services/integration_gateway.py` | `/decision-passport` | Live Ministry of Finance lease lines |
