"""
Script to seed demo schemes (NFST and NOS) via the API.

This script is NOT run automatically by seed.py. It requires a running API server
and a valid SUPER_ADMIN token.

Usage:
    # 1. Start the API server
    uvicorn app.main:app --host 0.0.0.0 --port 8000

    # 2. In another terminal, run this script with the SUPER_ADMIN token
    python -m app.db.seed_schemes --token <SUPER_ADMIN_TOKEN>

    # Or if the server is on a different host/port:
    python -m app.db.seed_schemes --url http://localhost:8000 --token <SUPER_ADMIN_TOKEN>

The SUPER_ADMIN token can be obtained by logging in:
    curl -X POST http://localhost:8000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "admin@scholarship.gov.in", "password": "Admin@123"}'
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Any

import requests


def load_fixture(filename: str) -> Dict[str, Any]:
    """Load JSON fixture from app/fixtures."""
    filepath = Path(__file__).resolve().parent.parent / "fixtures" / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def create_scheme(base_url: str, token: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """Create a scheme via the API."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "code": config["scheme_code"],
        "name": config.get("name", config["scheme_code"]),
        "description": config.get("description", ""),
        "config": config,
        "is_active": True,
    }
    response = requests.post(
        f"{base_url}/api/schemes",
        headers=headers,
        json=payload,
        timeout=30,
    )
    return {
        "status_code": response.status_code,
        "response": response.json() if response.content else {},
    }


def main():
    parser = argparse.ArgumentParser(description="Seed demo schemes via API")
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Base URL of the API server (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--token",
        required=True,
        help="SUPER_ADMIN JWT access token",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force recreate schemes even if they exist (deletes and recreates)",
    )
    args = parser.parse_args()

    base_url = args.url.rstrip("/")
    token = args.token

    # Load fixture configs
    nfst_config = load_fixture("nfst_config.json")
    nos_config = load_fixture("nos_config.json")

    # Add name/description to configs if not present
    nfst_config["name"] = "National Fellowship for ST Students"
    nfst_config["description"] = "Fellowship for Scheduled Tribe students pursuing PhD"
    nos_config["name"] = "National Overseas Scholarship"
    nos_config["description"] = "Scholarship for ST students pursuing studies abroad"

    schemes_to_create = [
        ("NFST", nfst_config),
        ("NOS", nos_config),
    ]

    print(f"Seeding schemes to {base_url}...")
    print()

    for code, config in schemes_to_create:
        print(f"Creating scheme: {code} ({config['name']})")
        result = create_scheme(base_url, token, config)

        if result["status_code"] == 201:
            print(f"  ✓ Created successfully (ID: {result['response'].get('id')})")
        elif result["status_code"] == 409:
            # Scheme already exists
            print(f"  - Already exists (409 Conflict)")
            if args.force:
                print(f"  Force flag set - would need DELETE endpoint to recreate")
        elif result["status_code"] == 422:
            print(f"  ✗ Validation failed:")
            for error in result["response"].get("errors", []):
                print(f"    - {error}")
        else:
            print(f"  ✗ Failed (status {result['status_code']}): {result['response']}")

        print()

    # Verify by listing all schemes
    print("Verifying schemes...")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{base_url}/api/schemes", headers=headers)
    if response.status_code == 200:
        schemes = response.json()
        print(f"Total schemes: {len(schemes)}")
        for scheme in schemes:
            print(f"  - {scheme['code']}: {scheme['name']} (active: {scheme['is_active']})")
    else:
        print(f"Failed to list schemes: {response.status_code} - {response.text}")

    print()
    print("Done!")


if __name__ == "__main__":
    main()