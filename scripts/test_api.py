"""Quick API integration test — run from project root."""
import urllib.request as ur
import json

BASE = "http://127.0.0.1:8000"

def test_health():
    resp = ur.urlopen(f"{BASE}/api/health")
    data = json.loads(resp.read())
    assert data["status"] == "ok"
    print(f"[PASS] /api/health — demo_mode={data['demo_mode']}, llm_key={data['llm_key_present']}")

def test_extract_case3():
    boundary = "MBoundary123"
    body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"demo_case_id\"\r\n\r\n"
        f"case-3\r\n"
        f"--{boundary}--\r\n"
    ).encode()
    req = ur.Request(
        f"{BASE}/api/extract",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    resp = ur.urlopen(req)
    data = json.loads(resp.read())
    meds = data["meds"]
    print(f"[PASS] /api/extract case-3 — {len(meds)} meds extracted")
    for m in meds:
        print(f"       {m['name_raw']} -> {m['name_generic']} (conf={m['confidence']})")
    return meds

def test_check_case3(meds):
    body = json.dumps({"session_id": "test-001", "meds": meds}).encode()
    req = ur.Request(
        f"{BASE}/api/check",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    resp = ur.urlopen(req)
    data = json.loads(resp.read())
    alerts = data["alerts"]
    rule_ids = {a["rule_id"] for a in alerts}
    print(f"[PASS] /api/check case-3 — {len(alerts)} alerts: {sorted(rule_ids)}")
    for a in alerts:
        sev = a["severity"].upper()
        print(f"       [{sev}] {a['rule_id']}: {a['meds_involved']} -> {a['action']}")
    assert "R-INT-01" in rule_ids, f"Expected R-INT-01 in {rule_ids}"
    print("[PASS] R-INT-01 (warfarin+aspirin major interaction) correctly fired")

def test_check_case6():
    boundary = "MBoundary456"
    body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"demo_case_id\"\r\n\r\n"
        f"case-6\r\n"
        f"--{boundary}--\r\n"
    ).encode()
    req = ur.Request(
        f"{BASE}/api/extract", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    resp = ur.urlopen(req)
    meds = json.loads(resp.read())["meds"]
    body2 = json.dumps({"session_id": "test-006", "meds": meds}).encode()
    req2 = ur.Request(
        f"{BASE}/api/check", data=body2,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    result = json.loads(ur.urlopen(req2).read())
    rule_ids = {a["rule_id"] for a in result["alerts"]}
    print(f"[PASS] /api/check case-6 — alerts: {sorted(rule_ids)}")
    assert "R-INT-02" in rule_ids  # lisinopril+spironolactone
    assert "R-INT-03" in rule_ids  # digoxin+furosemide
    assert "R-RED-01" in rule_ids  # digoxin red flag
    print("[PASS] All expected rules fired for polypharmacy case-6")

if __name__ == "__main__":
    test_health()
    meds = test_extract_case3()
    test_check_case3(meds)
    test_check_case6()
    print("\n=== All API integration tests passed ===")
