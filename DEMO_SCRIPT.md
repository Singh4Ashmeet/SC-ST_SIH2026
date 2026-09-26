# Yojana Setu — Live Demo Run-of-Show Script

> **Demonstration Run-Time**: 6 – 8 minutes  
> **Target Audience**: SIH / Ministry of Tribal Affairs (MoTA) Evaluation Committee  
> **Core Theme**: A unified, config-driven lifecycle engine handling distinct scholarship schemes end-to-end with real AI/OCR document verification, transparent eligibility rules, resilient unhappy path handling, immutable audit trails, and post-selection tracking.

---

## 🔑 Quick Demo Credentials & Environment Cheat Sheet

Before presenting, make sure the local environment is seeded:
```bash
cd backend
python scripts/seed_demo.py
```

| Role | Email | Password | Persona / Purpose |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@tribal.gov.in` | `admin123` | Shri Rajeshwar Verma (System oversight, audit review) |
| **Scheme Admin** | `scheme.admin@tribal.gov.in` | `scheme123` | Smt. Sunita Sharma (Config designer, rules management) |
| **Scrutiny Officer** | `scrutiny@tribal.gov.in` | `scrutiny123` | Dr. Alok Nath (Document verification & deficiency detection) |
| **Selection Committee** | `selection@tribal.gov.in` | `selection123` | Prof. H. R. Soren (Final committee scoring & grant awards) |

> [!TIP]
> The seeded demo uses dynamic UUIDs stored in `demo_context.json`. You can also find all applications directly on the dashboard pages (`/dashboard/applications`, `/dashboard/scrutiny`, `/dashboard/selection`).

---

## 🎬 Act 1: Opening & The Configurability Proof (1:30 min)

### Goal
Prove that the platform is **zero-hardcoded**: two structurally different central schemes (National Fellowship for ST Students vs. National Overseas Scholarship) run on the **exact same engine** powered by dynamic JSON configurations.

### Steps
1. **Navigate to**: `http://localhost:3000/login`
2. **Login as**: `admin@tribal.gov.in` / `admin123`
3. **Navigate to**: `http://localhost:3000/dashboard/schemes`
4. **Click on**: **NFST** scheme card (`/dashboard/schemes/...`)
   - Scroll through **Eligibility Rules**: Notice JSONLogic rules (`age <= 36`, `annual_income <= 600000`, `category == 'ST'`).
   - Scroll through **Required Documents**: 4 domestic certificates (`caste_certificate`, `income_certificate`, `marksheet`, `bonafide_certificate`).
   - Scroll through **Workflow States**: 8 states (`submitted` → `eligibility_check` → `document_scrutiny` → `deficient` → `selection` → `approved` → `disbursed`).
5. **Open in a new tab or click back to**: **NOS** scheme card (`/dashboard/schemes/...`)
   - Contrast side-by-side: Notice completely different eligibility rules (`qualifying_exam_percent >= 60`, `admission_confirmed == true`, `age <= 35`).
   - Completely different document requirements: `passport`, `admission_letter`, `degree_transcript`.
   - Different terminal state: `visa_issued` instead of `disbursed`.

> 🗣️ **Talking Point (Judging Criterion: Configurability Proof)**:  
> *"Judges, rather than building custom silos for every scholarship scheme, this entire platform is driven by a declarative Scheme Configuration Engine. NFST and NOS have completely different eligibility rules, document formats, and approval paths — yet both execute on the exact same backend engine with zero code modifications."*

---

## 🎬 Act 2: Scenario 1 — NFST Golden Path & End-to-End Lifecycle (2:00 min)

### Goal
Walk an application that successfully completed the entire lifecycle, showcasing the automated eligibility check, officer document scrutiny, selection committee resolution, live audit log, and structured post-selection management.

### Steps
1. **Navigate to**: `http://localhost:3000/dashboard/applications`
2. **Locate & Click**: **Bikram Kishore Hansda** (`NFST` — State: `approved`).
3. **Application Detail Timeline & Data**:
   - Point out applicant metadata: ST doctoral scholar at JNU (Ph.D. Linguistics), family income ₹3.8L.
   - Point out the **Visual Lifecycle Progress Bar**: `submitted` → `eligibility_check` → `document_scrutiny` → `selection` → `approved`.
4. **Document Scrutiny Summary**:
   - Show all 4 documents verified (`caste_certificate`, `income_certificate`, `marksheet`, `bonafide_certificate`).
   - Expand `Extracted Fields`: Show OCR-extracted certificate numbers, issuing authorities, percentages, and dates extracted automatically.
5. **Audit Trail Section**:
   - Point to the chronological log:
     - `application_created`
     - `auto_evaluate` → `eligibility_check_passed`
     - `documents_verified` (Officer: Dr. Alok Nath)
     - `committee_approved` (Chair: Prof. H. R. Soren with score 94.5)
6. **Post-Selection Management**:
   - Click the button: **`Post-Selection Management`** (`/dashboard/applications/[id]/post-selection`)
   - Show **Disbursements**: Installment 1 (₹1,80,000, `DISBURSED` on 15 Aug 2026 via PFMS/DBT) and Installment 2 (₹1,80,000, `PENDING`).
   - Show **Renewals**: Academic Year 2026-27 (`APPROVED`), Cycle 2027-28 (`PENDING_REVIEW`).

> 🗣️ **Talking Point (Judging Criteria: Audit Trail & Post-Selection Domain)**:  
> *"Every single lifecycle transition writes an immutable, actor-attributed audit log with before/after state diffs. Post-selection tracking — disbursements and annual renewal reviews — is not buried in generic JSON; it is a first-class relational domain with automated role-based guardrails."*

---

## 🎬 Act 3: Scenario 2 — NOS Overseas Scholarship (1:00 min)

### Goal
Demonstrate that the same frontend and backend handle an overseas scholarship with international credentials seamlessly.

### Steps
1. **Navigate to**: `http://localhost:3000/dashboard/applications`
2. **Locate & Click**: **Arjun Prakash Sonkar** (`NOS` — State: `approved`).
3. **Show Details**:
   - Course: MSc in Artificial Intelligence, Imperial College London.
   - International Documents: Verified Indian Passport (expiry 2032), Unconditional Admission Letter from Imperial College, IIT Roorkee B.Tech transcript (84.5%).
4. **Post-Selection Management**:
   - Click **`Post-Selection Management`**: Show foreign university disbursement of ₹15,00,000 (Tranche 1 tuition & maintenance allowance remitted via international wire).

> 🗣️ **Talking Point (Judging Criterion: Versatility & Real-World Readiness)**:  
> *"Notice how the same interface dynamically adapted to international currency thresholds, overseas university admission confirmation, and passport verification — proving the platform is production-ready for Ministry schemes beyond domestic fellowships."*

---

## 🎬 Act 4: Scenario 3 — The Unhappy Path & Live Resubmission (2:00 min) ⭐ CRITICAL

### Goal
Demonstrate automated error detection with **stacked deficiency reasons**, and perform a **live resubmission** to watch the application transition out of the `deficient` state in real-time.

### Steps
1. **Navigate to**: `http://localhost:3000/dashboard/scrutiny`
2. **Click on the "Deficient" Tab**:
   - Open **Pooja Rameshwar Tirkey** (`NFST` — State: `deficient`).
3. **Examine Scrutiny Detail Page**:
   - Point out the deficiency banner: **Document Correction Required**.
   - Inspect **Income Certificate**: Show the stacked deficiency pills:
     - `EXPIRED_DATE`: Issued more than 1 year ago (validity exceeded).
     - `FORMAT_INVALID`: Negative income string (`-50000`).
     - `MISSING_FIELD`: Missing issuing authority / Tehsildar seal.
   - Inspect **Caste Certificate**: `MISSING_FIELD` (`category`), `FORMAT_INVALID` (`issue_date`).
4. **Switch to the Applicant Portal (Live Correction Flow)**:
   - Copy the applicant ID or open `http://localhost:3000/apply/status/[Pooja_ID]`.
   - Notice the applicant's view: Clear, non-technical instructions highlighting exactly why each document failed and what correction is required.
5. **Perform Live Resubmission**:
   - In the applicant portal (or via the Scrutiny modal `Re-upload Document`):
   - Click **Upload / Replace** on **Income Certificate**.
   - Select `sample_clean_income_certificate.pdf` (located at the root `d:\SCST\sample_clean_income_certificate.pdf`).
   - Click **Submit Replacement**.
   - Watch the backend immediately re-process the document through OCR & extraction.

> 🗣️ **Talking Point (Judging Criteria: Real AI Logic & Unhappy Path Handling)**:  
> *"Real-world governance fails on the unhappy path. Most portals simply reject candidates with a cryptic error code. Our AI pipeline diagnoses multiple stacked deficiency reasons simultaneously — expired validity, schema format errors, and missing stamps — giving the applicant clear instructions to remediate without administrative gridlock."*

---

## 🎬 Act 5: Scenario 4 — Automated Eligibility Engine Multi-Failure (1:00 min)

### Goal
Show how the automated eligibility engine transparently catches multiple simultaneous rule violations.

### Steps
1. **Navigate to**: `http://localhost:3000/dashboard/applications`
2. **Locate & Click**: **Devendra Nath Murmu** (`NOS` — State: `rejected`).
3. **Examine Eligibility Audit Details**:
   - Scroll to the **Audit Log**: Click to expand `eligibility_check_failed`.
   - Point out that all 3 criteria failed simultaneously:
     - Qualifying Exam Marks: `52%` (minimum requirement `60%`).
     - Admission Offer: `False` (unconditional admission offer required).
     - Age: `42 years` (maximum permissible age `35 years`).

> 🗣️ **Talking Point (Judging Criteria: Transparent Automated Evaluation)**:  
> *"The automated eligibility evaluator doesn't short-circuit silently on the first error; it records the full evaluation matrix in the audit log so grievance redressal officers can provide transparent, indisputable feedback."*

---

## 🎬 Act 6: Live Selection Committee Action (1:00 min)

### Goal
Show the dedicated Selection Committee screen where committee members review verified candidates and cast decisions.

### Steps
1. **Navigate to**: `http://localhost:3000/dashboard/selection`
   - Notice the queue of applications ready for committee scoring.
2. **Click on**: **Tanvi Siddharth Kamble** (`NOS` — MSc Robotics at ETH Zurich, 88% aggregate).
3. **Show Details**:
   - Candidate academic score summary.
   - Verified passport, unconditional admission offer, and degree transcript.
4. **Click**: **Approve** button.
   - Enter remarks: *"Unanimously approved under Science & Technology merit quota."*
   - Submit: Watch the state transition immediately to `approved` and seamlessly unlock post-selection management.

> 🗣️ **Talking Point (Judging Criterion: Role-Based Workflow Separation)**:  
> *"Scrutiny officers verify authenticity; selection committees evaluate merit. Our workflow engine strictly separates these roles with role-based access control, preventing conflicts of interest."*

---

## 🎬 Act 7: Closing & Aggregate Dashboard Overview (0:30 min)

### Goal
End on the high-level executive dashboard showing total volume, scheme distribution, workflow stage breakdowns, and financial disbursements.

### Steps
1. **Navigate to**: `http://localhost:3000/dashboard`
2. **Highlight the Metrics**:
   - **Total Applications**: 7 live applications across all stages.
   - **Deficient Applications**: Real-time count of deficient cases requiring citizen action.
   - **Financials**: Total Disbursed amount (₹16.8 Lakhs across NFST and NOS) + Pending Disbursements card.
   - **Breakdowns**: Visual bars showing workflow state distribution and scheme distribution.
   - **Live Audit Activity Feed**: Recent operations streaming into the overview.

> 🗣️ **Closing Summary (SIH26239 Connection)**:  
> *"To summarize: Yojana Setu solves the core mandate of SIH26239 for the Ministry of Tribal Affairs. From config-driven intake across diverse ST scholarship schemes, through automated AI scrutiny, cross-scheme conflict detection, merit-based ranking, and committee workflows, to financial disbursement, grievance management, and renewal tracking — everything is backed by an immutable audit trail and a responsive citizen portal."*

---

## 🌟 Optional Bonus: Ambiguous Document Reasoning (Future Extension Point)

If an evaluator asks about ambiguous or edge-case documents:
> *"As a stated extension point in our architecture, for documents where OCR confidence is low or stamps are damaged, the pipeline triggers an asynchronous multimodal LLM reasoning check that produces a human-readable analysis with high/medium/low confidence before assigning to officer review."*

---

## 📋 Rehearsal Self-Check Notes

| Step Checked | Result | Notes for Presenter |
| :--- | :--- | :--- |
| **Login & Auth** | Passed | Clear cookies/session beforehand or use Incognito. |
| **Scheme Configs** | Passed | NFST and NOS show clean contrast in eligibility and docs. |
| **Scenario 1 Detail** | Passed | Shows 4 verified docs + 2 disbursements + 2 renewals. |
| **Scenario 2 Detail** | Passed | Shows international docs + ₹15 Lakh overseas disbursement. |
| **Scenario 3 Deficient** | Passed | 3 stacked reasons visible on income cert (`EXPIRED_DATE`, `FORMAT_INVALID`, `MISSING_FIELD`). |
| **Live Resubmission** | Passed | Clean PDF available at `sample_clean_income_certificate.pdf`. |
| **Scenario 4 Ineligible** | Passed | 3 simultaneous failing rules recorded in audit log. |
| **Selection Queue** | Passed | Tanvi Kamble ready for 1-click committee approval. |
| **Dashboard Overview** | Passed | All 5 metric cards + CSS bars reflect the full ecosystem. |
