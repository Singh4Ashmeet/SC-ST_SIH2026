# Yojana Setu — 5-7 Minute Demonstration Guide for SIH Evaluators

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**Demo Narrative:** End-to-End Auditable Decision Workflow for Scheduled Tribe Students

---

## 1. Demo Narrative Arc & 6 Personas

To demonstrate the full lifecycle cleanly without switching between disconnected features, follow this 5–7 minute narrative using the platform's pre-configured personas:

1. **Applicant A (Clean Flow):** High confidence (96%), clean ST caste & income certificates &rarr; Auto-verified.
2. **Applicant B (Deficiency & Resubmission):** Expired certificate &rarr; Flagged with plain-language deficiency &rarr; Corrected & resubmitted &rarr; Cleared.
3. **Applicant C (Cross-Document Discrepancy):** Declared ₹4.0L income vs extracted ₹3.8L &rarr; Discrepancy detected &rarr; Routed to Human Scrutiny.
4. **Applicant D (Governance & Conflict of Interest):** Committee reviewer belongs to same university &rarr; Conflict automatically blocks decision until resolved.
5. **Applicant E (Merit Excellence):** Top-ranked Ph.D fellowship candidate &rarr; Transparent composite scoring.
6. **Applicant F (Policy Simulation Beneficiary):** Income ceiling shifted from ₹6L to ₹8L &rarr; Becomes newly eligible under proposed policy.

---

## 2. Step-by-Step Demo Script (5–7 Minutes)

### Minute 0:00 - 1:00 | The Problem & Value Proposition
- **Show:** Landing page (`/`) and Ministry problem statement context.
- **Narrate:** *"Conventional scholarship portals treat AI as a black box or rely on manual desk checks that take months. Yojana Setu embodies the principle: AI assists, rules decide, humans resolve uncertainty, and every decision is backed by a tamper-evident Decision Passport."*

### Minute 1:00 - 2:00 | Assisted Application & Document Ingestion
- **Action:** Open `/apply` &rarr; Click **NFST Scheme** &rarr; Toggle **Assisted Mode (हिन्दी / English)**.
- **Highlight:** Low-bandwidth mobile wizard, bilingual guidance, and document checklist with acceptable examples.
- **Action:** Submit application &rarr; Navigate to Document Upload.
- **Highlight:** Provider-abstracted OCR pipeline extracting structured fields (Income, Tribe, District, Date) with **real numerical confidence** and **line-level OCR region snippets** (no fake 92% claims).

### Minute 2:00 - 3:30 | The Flagship Decision Passport & Uncertainty Routing
- **Action:** Open Application Case File (`/dashboard/applications/[id]`) &rarr; Click **Decision Passport ⭐**.
- **Highlight Section 1 & 2:** Rule-by-rule JSON-Logic evaluation showing declared values vs extracted document evidence with cross-document match statuses.
- **Highlight Section 3 & 4:** Document Evidence highlighting with region snippets. Show the **Uncertainty-Aware Review Routing**:
  - Why high-confidence files are auto-cleared.
  - Why edge-case discrepancies trigger mandatory human scrutiny.
- **Highlight Section 5:** Government Integration Gateway with **DigiLocker & PFMS [SANDBOX]** statuses.

### Minute 3:30 - 4:30 | Human Oversight, Committee Integrity & Conflicts
- **Action:** Switch to **Committee Review** tab.
- **Highlight:** Quorum calculation (e.g. 3/3 members completed).
- **Show Conflict of Interest:** Highlight system detecting institutional affiliation between committee member and applicant, blocking final approval until formal declaration and resolution.

### Minute 4:30 - 6:00 | Policy Impact Simulator
- **Action:** Navigate to **Policy Simulator** (`/dashboard/simulation`).
- **Show:** Current Policy vs Proposed Policy editor.
- **Action:** Adjust the Annual Income Ceiling from **₹6,00,000 to ₹8,00,000** and click **Run Simulation**.
- **Highlight:**
  - Non-mutating sandbox (production scheme remains untouched).
  - Calculated financial budget delta based on configurable annual grant amounts.
  - Scrutiny workload shift (+12% projected scrutiny demand).
  - State and district impact breakdown.
  - Formal policy publishing lifecycle (`DRAFT` &rarr; `SIMULATED` &rarr; `APPROVED` &rarr; `PUBLISHED`).

### Minute 6:00 - 7:00 | Audit Integrity & Closing
- **Action:** Open **Audit Trail** (`/dashboard/audit`).
- **Highlight:** SHA-256 cryptographic chain connecting every state change from initial upload to final disbursement.
- **Conclude:** *"Yojana Setu transforms government administration from opaque bureaucracy into an evidence-backed, explainable, and accountable partnership between technology and human civil servants."*
