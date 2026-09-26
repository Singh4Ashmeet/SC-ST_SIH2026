# Yojana Setu — Security & Privacy Architecture

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**Document Classification:** Official Security Architecture & Threat Model

---

## 1. Security Overview

Government scholarship and fellowship portals handle sensitive citizen data (Scheduled Tribe identity certificates, income tax and tehsildar records, academic credentials, and bank account numbers). Yojana Setu enforces defense-in-depth across authentication, object-level authorization, input sanitization, and cryptographic auditability.

---

## 2. P0 Security Remediations Implemented

### 2.1 Credential & Secret Hygiene
- **Zero Hardcoded Secrets:** All database URLs, JWT signing secrets, object storage credentials, and provider endpoints are moved into external environment variables managed via `pydantic-settings`.
- **Database Fallback:** Local development defaults to isolated SQLite (`sqlite:///./scholarship_dev.db`) rather than insecure embedded production credentials.
- **Audit Tamper Restriction:** The audit tamper simulation endpoint (`POST /api/audit-log/simulate-tamper`) is strictly restricted to `SUPER_ADMIN` with explicit permission verification (`Permission.AUDIT_TAMPER_SIMULATE`).

### 2.2 Object-Level Authorization (Anti-IDOR / Anti-BOLA)
To eliminate Broken Object Level Authorization (BOLA/IDOR), all object access is guarded by centralized authorization helpers in `app/core/authorization.py`:
- `assert_application_ownership_or_permission()`
- `assert_document_ownership_or_permission()`
- `assert_grievance_ownership_or_permission()`

#### Enforcement Matrix:
| Endpoint | Applicant Check | Official Check | Unauthorized Response |
| :--- | :--- | :--- | :---: |
| `GET /api/applications/{id}` | Must own application | Requires `APPLICATION_VIEW` | **403 Forbidden** |
| `GET /api/applications/{id}/decision-passport` | Must own application | Requires `APPLICATION_VIEW` | **403 Forbidden** |
| `GET /api/documents/{id}/download` | Must own parent app | Requires `DOCUMENT_VIEW` | **403 Forbidden** |
| `POST /api/documents/{id}/verify` | Blocked (403) | Requires `DOCUMENT_VERIFY` | **403 Forbidden** |
| `POST /api/grievances/{id}/messages` | Must own grievance | Requires `GRIEVANCE_UPDATE` | **403 Forbidden** |

### 2.3 Role-Based Access Control (RBAC) & Fine-Grained Permissions
The system replaces brittle role checks with explicit permissions defined in `app/core/permissions.py`:
- `APPLICATION_VIEW`, `APPLICATION_EDIT`, `APPLICATION_ASSIGN`
- `DOCUMENT_VIEW`, `DOCUMENT_UPLOAD`, `DOCUMENT_VERIFY`, `DOCUMENT_FLAG`
- `SCRUTINY_ASSIGN`, `SCRUTINY_APPROVE`, `SCRUTINY_REJECT`, `SCRUTINY_RUN`
- `MERIT_VIEW`, `MERIT_REVIEW`, `MERIT_EVALUATE`
- `COMMITTEE_VOTE`, `COMMITTEE_APPROVE`
- `DISBURSEMENT_VIEW`, `DISBURSEMENT_APPROVE`
- `AUDIT_VIEW`, `AUDIT_VERIFY`, `AUDIT_TAMPER_SIMULATE`
- `POLICY_SIMULATE`, `POLICY_PUBLISH`

### 2.4 Privacy & Sensitive Data Masking (PII Protection)
In compliance with Government of India data protection guidelines:
- **Aadhaar Masking:** Full Aadhaar numbers are never stored in plain text or logged. All logs and adapter payloads mask UID to last 4 digits (e.g. `XXXXXXXX1234`).
- **Bank Account Masking:** Financial disbursement records and UI views display masked account numbers (e.g. `XXXXXXXX9102`).
- **Structured Log Sanitization:** OCR text payloads containing sensitive identity details are omitted from general application logs.

### 2.5 HTTP Security Headers & Middleware
Implemented in `backend/app/main.py`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`
- Request size limitations and MIME validation on document uploads.
