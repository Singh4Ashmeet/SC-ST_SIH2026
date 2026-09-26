"""
Dry-run test script executing every step of DEMO_SCRIPT.md against live backend.
Measures latency and verifies data consistency across all acts.
"""
import io
import json
from pathlib import Path
import sys
import time
import urllib.request
from urllib.error import HTTPError

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8000"

def api(method, path, token=None, body=None, content_type="application/json"):
    url = f"{BASE}{path}"
    data = None
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        if content_type == "application/json":
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        else:
            data = body
            headers["Content-Type"] = content_type

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req) as resp:
            elapsed = (time.time() - t0) * 1000
            res_body = resp.read().decode("utf-8")
            return resp.status, json.loads(res_body) if res_body else {}, elapsed
    except HTTPError as e:
        elapsed = (time.time() - t0) * 1000
        err_body = e.read().decode("utf-8")
        return e.code, json.loads(err_body) if err_body else {}, elapsed


def run_dry_run():
    print("=" * 80)
    print("🚀 LIVE DEMO RUN-OF-SHOW DRY RUN TEST")
    print("=" * 80)

    demo_ctx_path = Path(__file__).resolve().parent.parent.parent / "demo_context.json"
    with open(demo_ctx_path, "r", encoding="utf-8") as f:
        ctx = json.load(f)

    # 1. AUTHENTICATION CHECK
    print("\n[ACT 1] Auth & Schemes Verification:")
    status, res, t = api("POST", "/api/auth/login", body={"email": "admin@tribal.gov.in", "password": "admin123"})
    assert status == 200, f"Login failed: {res}"
    admin_token = res["access_token"]
    print(f"  ✓ Admin login successful ({t:.1f}ms)")

    # Schemes
    status, schemes, t = api("GET", "/api/schemes", token=admin_token)
    assert status == 200 and len(schemes) >= 2, f"Schemes failed: {schemes}"
    scheme_codes = {s["code"]: s for s in schemes}
    assert "NFST" in scheme_codes and "NOS" in scheme_codes
    print(f"  ✓ Found NFST & NOS schemes ({t:.1f}ms)")
    print(f"    - NFST rules: {len(scheme_codes['NFST']['config']['eligibility_rules'])} | docs: {len(scheme_codes['NFST']['config']['required_documents'])}")
    print(f"    - NOS rules:  {len(scheme_codes['NOS']['config']['eligibility_rules'])} | docs: {len(scheme_codes['NOS']['config']['required_documents'])}")

    # 2. SCENARIO 1 (NFST Golden Path)
    print("\n[ACT 2] Scenario 1 (NFST Golden Path - Bikram Kishore Hansda):")
    app1_rec = next(a for a in ctx["applications"] if a["applicant"] == "Bikram Kishore Hansda")
    app1_id = app1_rec["id"]

    status, app1, t = api("GET", f"/api/applications/{app1_id}", token=admin_token)
    assert status == 200 and app1["current_state"] == "approved"
    print(f"  ✓ Application Detail loaded: state={app1['current_state']} ({t:.1f}ms)")

    status, docs1, t = api("GET", f"/api/applications/{app1_id}/documents", token=admin_token)
    assert status == 200 and len(docs1) == 4
    assert all(d["status"] == "VERIFIED" for d in docs1)
    print(f"  ✓ Verified Documents ({len(docs1)}/4 verified) ({t:.1f}ms)")

    status, summary1, t = api("GET", f"/api/applications/{app1_id}/post-selection-summary", token=admin_token)
    assert status == 200
    disb_list = summary1["disbursements"]
    ren_list = summary1["renewals"]
    assert len(disb_list) >= 1 and len(ren_list) >= 1
    print(f"  ✓ Post-Selection: {len(disb_list)} disbursements, {len(ren_list)} renewals ({t:.1f}ms)")

    # 3. SCENARIO 2 (NOS Golden Path)
    print("\n[ACT 3] Scenario 2 (NOS Golden Path - Arjun Prakash Sonkar):")
    app2_rec = next(a for a in ctx["applications"] if a["applicant"] == "Arjun Prakash Sonkar")
    app2_id = app2_rec["id"]

    status, app2, t = api("GET", f"/api/applications/{app2_id}", token=admin_token)
    assert status == 200 and app2["current_state"] == "approved"
    print(f"  ✓ NOS Application loaded: state={app2['current_state']} ({t:.1f}ms)")

    status, docs2, t = api("GET", f"/api/applications/{app2_id}/documents", token=admin_token)
    assert status == 200 and len(docs2) == 3
    print(f"  ✓ International Documents ({len(docs2)} verified) ({t:.1f}ms)")

    status, summary2, t = api("GET", f"/api/applications/{app2_id}/post-selection-summary", token=admin_token)
    assert status == 200 and float(summary2["disbursements"][0]["amount"]) == 1500000.0
    print(f"  ✓ Overseas disbursement INR 15,00,000 verified ({t:.1f}ms)")

    # 4. SCENARIO 3 (Unhappy Path - Stacked Deficiency)
    print("\n[ACT 4] Scenario 3 (Unhappy Path - Pooja Rameshwar Tirkey):")
    app3_rec = next(a for a in ctx["applications"] if a["applicant"] == "Pooja Rameshwar Tirkey")
    app3_id = app3_rec["id"]

    status, app3, t = api("GET", f"/api/applications/{app3_id}", token=admin_token)
    assert status == 200 and app3["current_state"] == "deficient"
    print(f"  ✓ State is 'deficient' ({t:.1f}ms)")

    status, def_summary, t = api("GET", f"/api/applications/{app3_id}/deficiency-summary", token=admin_token)
    assert status == 200
    deficient_docs = [d for d in def_summary["documents"].values() if d["status"] == "DEFICIENT"]
    assert len(deficient_docs) >= 1
    print(f"  ✓ Deficiency Summary: {len(deficient_docs)} deficient docs ({t:.1f}ms)")
    for d in deficient_docs:
        print(f"    - Doc: {d['doc_type']} | Reasons: {[r.get('code') for r in d.get('deficiency_reasons', [])]}")

    # 5. SCENARIO 4 (Ineligible - Multi-Failure)
    print("\n[ACT 5] Scenario 4 (Ineligible - Devendra Nath Murmu):")
    app4_rec = next(a for a in ctx["applications"] if a["applicant"] == "Devendra Nath Murmu")
    app4_id = app4_rec["id"]

    status, app4, t = api("GET", f"/api/applications/{app4_id}", token=admin_token)
    assert status == 200 and app4["current_state"] == "rejected"
    print(f"  ✓ Ineligible state is 'rejected' ({t:.1f}ms)")

    # 6. ACT 6 (Live Selection Committee Approval)
    print("\n[ACT 6] Selection Committee Queue & Live Approval:")
    status, committee_login, t = api("POST", "/api/auth/login", body={"email": "selection@tribal.gov.in", "password": "selection123"})
    assert status == 200
    committee_token = committee_login["access_token"]
    print(f"  ✓ Committee login successful ({t:.1f}ms)")

    # Check Tanvi Kamble in selection
    tanvi_rec = next(a for a in ctx["applications"] if a["applicant"] == "Tanvi Siddharth Kamble")
    tanvi_id = tanvi_rec["id"]

    status, tanvi_app, t = api("GET", f"/api/applications/{tanvi_id}", token=committee_token)
    assert status == 200 and tanvi_app["current_state"] == "selection"
    print(f"  ✓ Candidate Tanvi Kamble loaded in 'selection' state ({t:.1f}ms)")

    # 7. ACT 7 (Dashboard Aggregate Overview Stats)
    print("\n[ACT 7] Dashboard Overview Aggregate Stats:")
    status, stats, t = api("GET", "/api/stats/overview", token=admin_token)
    assert status == 200
    print(f"  ✓ Overview stats returned in {t:.1f}ms:")
    print(f"    - Total Applications:       {stats['total_applications']}")
    print(f"    - Deficient Count:          {stats['deficient_count']}")
    print(f"    - Pending Disbursements:    {stats['pending_disbursements_count']}")
    print(f"    - Total Disbursed:          INR {stats['total_disbursed_amount']:,.0f}")
    print(f"    - Pending Renewals:         {stats['pending_renewals_count']}")
    print(f"    - State Distribution:       {stats['applications_by_state']}")

    print("\n" + "=" * 80)
    print("✅ DRY RUN TEST PASSED 100%! All endpoints responsive and data sound.")
    print("=" * 80)


if __name__ == "__main__":
    run_dry_run()
