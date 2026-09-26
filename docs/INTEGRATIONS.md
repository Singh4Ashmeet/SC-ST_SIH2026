# Yojana Setu — Government Integration Gateway

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**Subsystem:** Government Integration Gateway  
**Service:** `app/services/integration_gateway.py`  
**API Router:** `app/api/integrations.py`

---

## 1. Gateway Purpose & Honesty Statement

To provide end-to-end administration of tribal scholarship and fellowship schemes, a digital platform must interface with national digital public infrastructure:
1. **DigiLocker:** Verification of central and state digital certificates.
2. **API Setu:** Interoperability with State e-District and Revenue portals.
3. **PFMS (Public Financial Management System):** Bank account validation and payment mandate processing.
4. **DBT Bharat & NPCI Mapper:** Verification of Aadhaar-bank account seeding for Direct Benefit Transfer.

### SIH Technical Credibility Notice:
> In compliance with strict technical integrity standards, **Yojana Setu does not claim live production government lease lines or active departmental credentials that have not been provisioned.**
> 
> The system implements a **production-grade Adapter Architecture** operating with realistic **Sandbox/Mock Adapters**. All outputs and UI views explicitly display **`[SANDBOX]`** to guarantee complete honesty before technical judges and evaluators.

---

## 2. Adapter Architecture

```text
                        VERIFICATION GATEWAY
                                  │
      ┌──────────────────┬────────┴─────────┬──────────────────┐
      ▼                  ▼                  ▼                  ▼
 DigiLocker          API Setu             PFMS             DBT Bharat
 Sandbox Adapter   Sandbox Adapter   Sandbox Adapter     Sandbox Adapter
      │                  │                  │                  │
   Caste &            State e-District   Bank IFSC &       NPCI Aadhaar
   Income Certs       SDO Verification   Account Match     Bridge Seeding
```

### Standardized `VerificationResult`:
```json
{
  "source": "DigiLockerSandbox",
  "is_sandbox": true,
  "document_id": "JH-ST-2024-001928",
  "status": "VERIFIED",
  "confidence": 0.99,
  "authority_name": "Department of Revenue & Land Reforms, Govt. of Jharkhand via DigiLocker [SANDBOX]",
  "evidence_reference": "in.gov.jh.edistrict-cas-JH-ST-2024-001928",
  "fields": {
    "verified_name": "Birsa Munda",
    "verified_category": "ST",
    "valid_until": "PERMANENT"
  },
  "verified_at": "2026-09-27T01:46:18Z"
}
```

---

## 3. Transition to Production Government Endpoints

To transition from Sandbox mode to live production ministries:
1. **DigiLocker Production:** Configure `DIGILOCKER_CLIENT_ID`, `DIGILOCKER_CLIENT_SECRET`, and production gateway URL (`https://api.digitallocker.gov.in`).
2. **API Setu Production:** Register OAuth2 application with API Setu developer portal and provision ministerial API key.
3. **PFMS Integration:** Establish secure VPN lease line with Ministry of Finance PFMS SFTP/REST gateway and import DSC (Digital Signature Certificates) for DBT payment XML generation.
4. **DBT Bharat / NPCI:** Provision UIDAI AUA/KUA sub-license for Aadhaar OTP authentication and NPCI NACH sponsor bank interface.
