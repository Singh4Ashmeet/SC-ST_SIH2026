import json
import httpx

client = httpx.Client(base_url="http://localhost:8000")

print("=== 1. Validating NFST Fixture via POST /api/schemes/validate-config ===")
with open("app/fixtures/nfst_config.json", "r", encoding="utf-8") as f:
    nfst = json.load(f)
r_nfst = client.post("/api/schemes/validate-config", json=nfst)
print(f"HTTP Status: {r_nfst.status_code}")
data_nfst = r_nfst.json()
print(f"valid: {data_nfst['valid']}")
print(f"scheme_code: {data_nfst['config']['scheme_code']}")
print(f"workflow_states count: {len(data_nfst['config']['workflow_states'])}")
print(f"workflow_transitions count: {len(data_nfst['config']['workflow_transitions'])}")
print(f"required_documents count: {len(data_nfst['config']['required_documents'])}")
print(f"eligibility_rules count: {len(data_nfst['config']['eligibility_rules'])}")

print("\n=== 2. Validating NOS Fixture via POST /api/schemes/validate-config ===")
with open("app/fixtures/nos_config.json", "r", encoding="utf-8") as f:
    nos = json.load(f)
r_nos = client.post("/api/schemes/validate-config", json=nos)
print(f"HTTP Status: {r_nos.status_code}")
data_nos = r_nos.json()
print(f"valid: {data_nos['valid']}")
print(f"scheme_code: {data_nos['config']['scheme_code']}")
print(f"workflow_states count: {len(data_nos['config']['workflow_states'])}")
print(f"workflow_transitions count: {len(data_nos['config']['workflow_transitions'])}")
print(f"required_documents count: {len(data_nos['config']['required_documents'])}")
print(f"eligibility_rules count: {len(data_nos['config']['eligibility_rules'])}")

print("\n=== 3. Testing Deliberately Broken Config via POST /api/schemes/validate-config ===")
broken = {
    "scheme_code": "BROKEN_SCHEME",
    "initial_state": "nonexistent_start",
    "workflow_states": [
        {"name": "submitted", "label": "Submitted", "is_terminal": False}
    ],
    "workflow_transitions": [
        {"from_state": "submitted", "to_state": "nowhere", "trigger": "jump", "allowed_roles": []}
    ],
    "required_documents": [
        {"doc_type": "doc_a", "label": "Doc A", "required": True, "accepted_formats": ["pdf"]},
        {"doc_type": "doc_a", "label": "Duplicate Doc A", "required": True, "accepted_formats": ["pdf"]}
    ]
}
r_broken = client.post("/api/schemes/validate-config", json=broken)
print(f"HTTP Status: {r_broken.status_code}")
data_broken = r_broken.json()
print(f"valid: {data_broken['valid']}")
print("Collected Errors:")
for err in data_broken.get("errors", []):
    print(f"  - {err}")
