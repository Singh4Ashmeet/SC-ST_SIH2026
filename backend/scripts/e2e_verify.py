"""
E2E verification script: login, list apps, approve selection, record disbursement, start renewal, check stats.
"""
import json
import sys
import urllib.request

BASE = "http://127.0.0.1:8000"

def api(method, path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()}")
        sys.exit(1)

# 1. Login
print("=== 1. Login as admin ===")
login = api("POST", "/api/auth/login", body={"email": "admin@tribal.gov.in", "password": "admin123"})
token = login["access_token"]
print(f"  Token obtained for role: {login.get('user', {}).get('role', 'unknown')}")

# 2. List applications
print("\n=== 2. List all applications ===")
apps = api("GET", "/api/applications", token=token)
for a in apps:
    print(f"  {a['id'][:8]}... | {a['applicant_name']:25s} | {a['current_state']}")

# 3. Find the application in "selection" state (Priya Devi Paswan)
selection_app = next((a for a in apps if a["current_state"] == "selection"), None)
if selection_app:
    app_id = selection_app["id"]
    print(f"\n=== 3. Approve selection for {selection_app['applicant_name']} ({app_id[:8]}...) ===")
    
    # Get available transitions
    transitions = api("GET", f"/api/applications/{app_id}/available-transitions", token=token)
    print(f"  Available transitions: {transitions}")
    
    # Find the approve trigger
    approve_trigger = None
    for t in transitions:
        trigger = t.get("trigger", "")
        if "approv" in trigger.lower() or "award" in trigger.lower():
            approve_trigger = trigger
            break
    
    if approve_trigger:
        print(f"  Using trigger: {approve_trigger}")
        result = api("POST", f"/api/applications/{app_id}/transition", token=token, body={
            "trigger": approve_trigger,
            "remarks": "Award approved by Selection Committee unanimous vote"
        })
        print(f"  Result: state -> {result.get('current_state', 'unknown')}")
    else:
        print(f"  No approve trigger found in {transitions}")
else:
    # Check if already approved
    approved_app = next((a for a in apps if a["applicant_name"] == "Priya Devi Paswan"), None)
    if approved_app:
        app_id = approved_app["id"]
        print(f"\n=== 3. Priya Devi Paswan already in state: {approved_app['current_state']} (id: {app_id[:8]}...) ===")
    else:
        print("\n=== 3. No matching application found ===")
        sys.exit(1)

# 4. Record a disbursement
print(f"\n=== 4. Record disbursement for {app_id[:8]}... ===")
disb = api("POST", f"/api/applications/{app_id}/disbursements", token=token, body={
    "amount": 150000,
    "installment_number": 1,
    "remarks": "First semester fellowship stipend"
})
disb_id = disb["id"]
print(f"  Disbursement created: {disb_id[:8]}... | status={disb['status']} | amount={disb['amount']}")

# 5. Update disbursement to DISBURSED
print(f"\n=== 5. Update disbursement status to DISBURSED ===")
updated = api("PATCH", f"/api/disbursements/{disb_id}", token=token, body={
    "status": "DISBURSED",
    "remarks": "Transferred via PFMS"
})
print(f"  Updated: status={updated['status']} | disbursed_date={updated.get('disbursed_date')}")

# 6. Start a renewal cycle
print(f"\n=== 6. Start renewal cycle ===")
renewal = api("POST", f"/api/applications/{app_id}/renewals", token=token, body={
    "academic_year_or_cycle": "2026-27",
    "due_date": "2027-03-31",
    "remarks": "Annual renewal review cycle"
})
print(f"  Renewal created: {renewal['id'][:8]}... | cycle={renewal['academic_year_or_cycle']} | status={renewal['status']}")

# 7. Get post-selection summary
print(f"\n=== 7. Post-selection summary ===")
summary = api("GET", f"/api/applications/{app_id}/post-selection-summary", token=token)
print(f"  Disbursements: {len(summary.get('disbursements', []))}")
print(f"  Renewals: {len(summary.get('renewals', []))}")

# 8. Get stats overview
print(f"\n=== 8. Dashboard overview stats ===")
stats = api("GET", "/api/stats/overview", token=token)
print(f"  total_applications:        {stats['total_applications']}")
print(f"  deficient_count:           {stats['deficient_count']}")
print(f"  pending_disbursements:     {stats['pending_disbursements_count']}")
print(f"  total_disbursed_amount:    INR {stats['total_disbursed_amount']:,.0f}")
print(f"  pending_renewals_count:    {stats['pending_renewals_count']}")
print(f"  applications_by_state:     {json.dumps(stats['applications_by_state'])}")
print(f"  applications_by_scheme:    {json.dumps(stats['applications_by_scheme'])}")
print(f"  recent_activity count:     {len(stats.get('recent_activity', []))}")
for act in stats.get("recent_activity", [])[:5]:
    print(f"    {act['action']:30s} | {act.get('from_state',''):20s} -> {act.get('to_state','')}")

print("\n[OK] E2E verification complete!")
