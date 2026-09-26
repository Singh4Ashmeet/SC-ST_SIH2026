# Yojana Setu — Policy Impact Simulator

**Problem Statement:** SIH26239 | Ministry of Tribal Affairs  
**Feature:** Policy Impact Simulator & Sandboxed Policy Engine  
**Service:** `app/services/policy_simulation_engine.py`  
**Endpoint:** `POST /api/simulations/run`, `POST /api/simulations/{id}/publish`

---

## 1. Overview & Ministerial Need

When the Ministry of Tribal Affairs considers adjusting scholarship criteria—such as:
- Raising the annual family income ceiling from **₹6,00,000 to ₹8,00,000**
- Modifying doctoral research publication weighting from **30% to 35%**
- Introducing regional priority weightings for aspirational tribal districts

Policy administrators need to know in advance:
1. *How many additional students will become eligible?*
2. *What will be the exact financial commitment on the scheme budget?*
3. *How will the verification workload on desk scrutiny officers shift?*

The **Policy Impact Simulator** provides evidence-based forecasting without mutating production schemes or impacting active applications.

---

## 2. Non-Mutating Sandboxed Architecture

```text
       ACTIVE PRODUCTION SCHEME (e.g. NFST v1)
                         │
                         ▼
        PROPOSED POLICY CONFIGURATION (DRAFT)
                         │
                         ▼
    HISTORICAL / SYNTHETIC APPLICANT COHORT
                         │
                         ▼
             ISOLATED SIMULATION ENGINE
                         │
       ┌─────────────────┴─────────────────┐
       ▼                                   ▼
 ELIGIBILITY / MERIT SIMULATION     FINANCIAL & WORKLOAD MODEL
       │                                   │
       └─────────────────┬─────────────────┘
                         ▼
             SIMULATION RESULTS COMPARISON
          (Newly Eligible / Budget Delta / Workload)
                         │
                         ▼
            ADMINISTRATIVE REVIEW & APPROVAL
                         │
                         ▼
       AUTHORIZED "PUBLISH POLICY" OPERATION
       (Commits new SchemeConfig version & sets active)
```

### Safety Guarantee:
Simulations operate in an isolated context. No active application status or live scheme rules are modified during simulation. A simulation can only affect production if explicitly committed via `POST /api/simulations/{id}/publish` by an authorized `SUPER_ADMIN` with `Permission.POLICY_PUBLISH`.

---

## 3. Configurable Financial & Workload Projections

In adherence to Section 12 of the requirements, hardcoded financial constants have been removed:
- **Annual Grant Calculation:** Dynamically resolved from `scheme.config.financial.annual_grant_per_student` or stipend configuration.
- **Estimated Budget Impact:**
  $$\Delta \text{Budget} = (\text{Proposed Eligible} - \text{Current Eligible}) \times \text{Configured Grant Amount}$$
- **Workload Forecasting:** Calculates the projected percentage change in document scrutiny volume and deficiency resolution tickets.

---

## 4. Policy State Lifecycle

1. **`DRAFT`:** Proposed criteria changes defined by an officer.
2. **`SIMULATED`:** Simulation run against historical cohorts; comparative metrics generated.
3. **`APPROVED`:** Ministerial review committee approves proposed policy version.
4. **`PUBLISHED`:** Changes committed to the live scheme database; previous version archived in audit history.
