#!/usr/bin/env python3
"""
MedBridge environment checker.
Run BEFORE anything else:  python scripts/check_env.py
Prints exactly what is missing and the precise fix command.
"""
import importlib
import io
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
ENV_FILE = ROOT / ".env"

PASS  = "\u2705"
FAIL  = "\u274c"
WARN  = "\u26a0\ufe0f"

results: list[tuple[bool, str, str]] = []   # (ok, label, fix)


def check(ok: bool, label: str, fix: str = "") -> bool:
    results.append((ok, label, fix))
    icon = PASS if ok else FAIL
    print(f"  {icon}  {label}")
    if not ok and fix:
        for line in fix.splitlines():
            print(f"       {line}")
    return ok


# ── Python version ─────────────────────────────────────────────────────────────
v = sys.version_info
check(v >= (3, 11), f"Python {v.major}.{v.minor}.{v.micro}",
      "Need Python 3.11+. https://www.python.org/downloads/")

# ── pip packages ───────────────────────────────────────────────────────────────
print("\n── Python packages ──────────────────────────────────────────────────────")
PKGS = {
    "fastapi":            "pip install fastapi",
    "uvicorn":            "pip install uvicorn[standard]",
    "pydantic":           "pip install pydantic",
    "pytesseract":        "pip install pytesseract",
    "PIL":                "pip install Pillow",
    "cv2":                "pip install opencv-python-headless",
    "numpy":              "pip install numpy",
    "rapidfuzz":          "pip install rapidfuzz",
    "google.generativeai":"pip install google-generativeai",
    "multipart":          "pip install python-multipart",
    "textstat":           "pip install textstat",
    "pytest":             "pip install pytest pytest-cov",
}
for mod, cmd in PKGS.items():
    try:
        importlib.import_module(mod)
        check(True, f"import {mod}")
    except ImportError:
        check(False, f"import {mod}", f"Run: {cmd}")

# ── Tesseract binary ───────────────────────────────────────────────────────────
print("\n── Tesseract binary ────────────────────────────────────────────────────")
tess_path = shutil.which("tesseract")
tess_ok = False
if tess_path:
    try:
        r = subprocess.run(["tesseract", "--version"],
                           capture_output=True, text=True, timeout=10)
        tess_ver = (r.stdout + r.stderr).splitlines()[0]
        tess_ok = check(True, f"tesseract: {tess_ver} at {tess_path}")
    except Exception as e:
        check(False, "tesseract binary", str(e))
else:
    check(False, "tesseract not on PATH",
          "Windows: install UB Mannheim build then add to PATH\n"
          "  https://github.com/UB-Mannheim/tesseract/wiki\n"
          "macOS:   brew install tesseract tesseract-lang\n"
          "Linux:   sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-tam")

# ── Tamil language data ────────────────────────────────────────────────────────
print("\n── Tesseract language data ──────────────────────────────────────────────")
if tess_ok:
    try:
        r = subprocess.run(["tesseract", "--list-langs"],
                           capture_output=True, text=True, timeout=10)
        langs = {l.strip() for l in (r.stdout + r.stderr).splitlines()
                 if l.strip() and not l.startswith("List")}
        check("eng" in langs, "eng language data installed")
        check("tam" in langs, "tam (Tamil) language data installed",
              "Windows: re-run UB Mannheim installer, tick Tamil.\n"
              "macOS:   brew install tesseract-lang\n"
              "Linux:   sudo apt install tesseract-ocr-tam\n"
              "Manual:  download tam.traineddata from\n"
              "  https://github.com/tesseract-ocr/tessdata\n"
              "  and copy to your Tesseract tessdata/ folder.")
    except Exception as e:
        check(False, "Cannot list Tesseract languages", str(e))
else:
    print(f"  {WARN}  Skipping language data check (binary missing)")

# ── .env ───────────────────────────────────────────────────────────────────────
print("\n── Environment / secrets ─────────────────────────────────────────────────")
if ENV_FILE.exists():
    check(True, ".env file present")
    ev: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            ev[k.strip()] = v.strip()
    check(bool(ev.get("LLM_API_KEY", "").strip()), "LLM_API_KEY set",
          "Add  LLM_API_KEY=<your key>  to .env\n"
          "Get a Gemini key: https://aistudio.google.com/app/apikey")
    check(bool(ev.get("LLM_MODEL", "").strip()), "LLM_MODEL set",
          "Add  LLM_MODEL=gemini-2.0-flash  to .env")
    dm = ev.get("DEMO_MODE", "false").lower()
    ct = ev.get("CONF_THRESHOLD", "0.6")
    check(True, f"DEMO_MODE={dm}")
    check(True, f"CONF_THRESHOLD={ct}")
else:
    check(False, ".env missing",
          "cp .env.example .env   then fill in LLM_API_KEY")

# ── Smoke test ────────────────────────────────────────────────────────────────
print("\n── Smoke test (pytesseract) ─────────────────────────────────────────────")
try:
    import pytesseract
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (320, 60), "white")
    ImageDraw.Draw(img).text((10, 15), "MedBridge 500mg", fill="black")
    text = pytesseract.image_to_string(img).strip()
    ok = "500" in text or "MedBridge" in text
    check(ok, f"pytesseract reads test image  (got: '{text[:50]}')",
          "Tesseract binary may not be on PATH even if installed.\n"
          "Set TESSDATA_PREFIX env var or pytesseract.pytesseract.tesseract_cmd.")
except Exception as e:
    check(False, f"pytesseract smoke test: {e}")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n─────────────────────────────────────────────────────────────────────────")
passed = sum(ok for ok, _, _ in results)
total  = len(results)
fails  = [(lbl, fix) for ok, lbl, fix in results if not ok]
print(f"\n  {passed}/{total} checks passed.\n")
if fails:
    print(f"  {FAIL} Fix these before proceeding:\n")
    for lbl, fix in fails:
        print(f"  • {lbl}")
        for l in fix.splitlines():
            print(f"    {l}")
    sys.exit(1)
else:
    print(f"  {PASS} Environment ready — proceed to Milestone 1.\n")
    sys.exit(0)
