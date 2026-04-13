# fixtures

Small hand-crafted Apple Health export samples used as TDD inputs.

## Files

- `tiny.xml` — (TODO §2 of the plan) ~20 records covering every HK record type the parser must handle. Goal: smallest possible input that still exercises every code path.
- `edge-cases.xml` — (TODO) NBSP source names, humidity hundredths, SpO2 decimals, overlapping iPhone+Watch steps, Withings/MyFitnessPal weight duplicates, sleep crossing 6am.
- `expected/*.md` — canonical markdown outputs generated from the reference Python implementation (`~/workspace/apple-health-gpt/`) run against `tiny.xml`. These are the snapshot targets for the writer tests.

## Regenerating expected outputs

```bash
cd ~/workspace/apple-health-gpt
python -m apple_health_gpt ~/workspace/openhealth/fixtures/tiny.xml \
  -o ~/workspace/openhealth/fixtures/expected
```

Only do this when `tiny.xml` changes. Commit the regenerated markdown.
