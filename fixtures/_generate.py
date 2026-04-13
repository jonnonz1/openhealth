"""Generate fixtures/expected/*.md from tiny.xml using the Python reference tool.

Run from repo root:
    python3 fixtures/_generate.py

Frozen ref_date keeps snapshots deterministic across machines/dates.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path.home() / "workspace" / "apple-health-gpt"))

from apple_health_gpt.parser import parse
from apple_health_gpt.writers import write_all

FIXTURES = REPO / "fixtures"
TINY = FIXTURES / "tiny.xml"
OUT = FIXTURES / "expected"
REF_DATE = date(2026, 4, 13)

# Parser expects the file to be named export.xml. Symlink-as-view via a temp copy.
import shutil, tempfile
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    shutil.copy(TINY, td / "export.xml")
    data = parse(td / "export.xml", max_hr=180)

OUT.mkdir(parents=True, exist_ok=True)
write_all(data, OUT, ref_date=REF_DATE)

for f in sorted(OUT.glob("*.md")):
    print(f"{f.name}: {f.stat().st_size} bytes")
