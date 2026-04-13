# fixtures

Small hand-crafted Apple Health export samples used as TDD inputs.

All data here is **synthetic** — no personal information. This is an opensource repo.

## Files

- `tiny.xml` — ~25 records covering every HK type the parser touches. Smallest input that still exercises every code path (multi-source step dedup, NBSP source names, humidity hundredths, SpO2 decimal, weight dedup, sleep source priority, 6am sleep boundary, workout stats + metadata).
- `expected/*.md` — canonical markdown outputs generated from the Python reference (`~/workspace/apple-health-gpt/`) with `ref_date = 2026-04-13`. Snapshot targets for writer tests.
- `_generate.py` — regenerates `expected/` from `tiny.xml`. Frozen `ref_date` keeps snapshots deterministic across machines.

## Regenerating expected outputs

Only run this when `tiny.xml` changes. Commit the regenerated markdown.

```bash
python3 fixtures/_generate.py
```

Requires the Python reference repo at `~/workspace/apple-health-gpt/`.
