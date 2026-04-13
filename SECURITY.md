# Security Policy

## Reporting a vulnerability

If you believe you've found a security issue in `openhealth`, please **do not open a public issue**. Instead, open a private security advisory on GitHub:

<https://github.com/jonnonz1/openhealth/security/advisories/new>

Please include:

- A description of the issue
- Steps to reproduce (or a proof-of-concept)
- The version / commit SHA you tested against
- Any suggested remediation, if you have one

You can expect an initial response within a few days. Since this is an unfunded open-source project maintained in spare time, patch timelines depend on complexity — we'll communicate honestly about what to expect.

## Scope

`openhealth` is a client-side tool. There is no server that processes user data, so the threat model centres on:

- **Parser correctness** — a malicious or malformed `export.xml` should never crash the browser, exhaust memory, or trigger code execution.
- **Supply-chain integrity** — dependencies should be minimal, pinned, and regularly audited.
- **WebRTC handoff** — the signaling relay must never be able to read or intercept file data (only WebRTC handshake metadata passes through it).
- **Static site integrity** — the hosted site must serve identical code to what's in this repo. The `pnpm -C packages/web build && pnpm -C packages/web preview` command reproduces the deployed build locally.

Thank you for helping keep `openhealth` trustworthy.
