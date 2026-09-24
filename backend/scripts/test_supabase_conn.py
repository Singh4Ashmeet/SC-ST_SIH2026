import psycopg2
import socket
import sys

project_ref = "aosgyxpctnrxorxgfgoi"
password = "9NqlFZAcgMpwgCEB"

# Test direct IPv6 with explicit AF_INET6
print("--- 1. Testing Direct IPv6 with AF_INET6 ---")
try:
    infos = socket.getaddrinfo(f"db.{project_ref}.supabase.co", 5432, socket.AF_INET6)
    print(f"IPv6 Addrs found: {[i[4][0] for i in infos]}")
    ipv6_addr = infos[0][4][0]
    conn_str = f"postgresql://postgres:{password}@[{ipv6_addr}]:5432/postgres"
    print(f"Connecting to {conn_str}...")
    conn = psycopg2.connect(conn_str, connect_timeout=10)
    print("SUCCESS CONNECTING TO DIRECT IPV6!")
    conn.close()
except Exception as e:
    print(f"Direct IPv6 failed: {e}")

# Test pooler regions across AWS / GCP
print("\n--- 2. Testing Pooler Regions ---")
aws_regions = [
    "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-east-1",
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2", "eu-north-1",
    "sa-east-1", "ca-central-1", "me-central-1", "af-south-1"
]

for reg in aws_regions:
    for prefix in ["aws-0", "aws-1"]:
        host = f"{prefix}-{reg}.pooler.supabase.com"
        for port in [6543, 5432]:
            conn_str = f"postgresql://postgres.{project_ref}:{password}@{host}:{port}/postgres"
            try:
                conn = psycopg2.connect(conn_str, connect_timeout=3)
                print(f"SUCCESS MATCH: {conn_str}")
                conn.close()
                sys.exit(0)
            except Exception as e:
                err_msg = str(e).strip().replace("\n", " ")
                if "tenant/user" not in err_msg and "Name or service not known" not in err_msg:
                    print(f"[{host}:{port}] -> {err_msg}")
