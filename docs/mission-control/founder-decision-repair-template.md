# FOUNDER_DECISION_REPAIR template

Use only for exactly one syntactically malformed immutable ordinary no-PR
`FOUNDER_DECISION`, one exact no-PR gate, and one trusted-Founder repair. Both
the malformed predecessor's native author and the repair's native author must
match current merged `trusted_founder_login`; the repair's declared login must
also match. The malformed predecessor itself grants no authority. A
syntactically valid ordinary decision is not repairable, including one that is
stale or bound to a wrong identity. Multiple ordinary decisions remain STOP.

Obtain current repository, Issue, branch/head, protected-base, and merged-policy
bindings through fresh registered Context. Bind the exact native gate ID/URL
and malformed predecessor ID/URL. Hash the exact unchanged UTF-8 predecessor
body, including all real line breaks and literal backslash characters, using
SHA-256. Do not trim, unescape, normalize, or reserialize that body. Put its
lowercase 64-hex digest in `source_founder_decision.body_sha256`. The gate,
predecessor, and repair must have distinct native comment identities.

Replace every sample value below with that live evidence. Preserve the heading,
real line breaks, canonical `json` fence, two-space JSON formatting, exact
field set, and final newline. The example establishes syntax only. Never
publish its sample values.

<!-- founder-decision-repair:example:start -->
````text
## FOUNDER_DECISION_REPAIR

```json
{
  "schema_version": 1,
  "record_type": "FOUNDER_DECISION_REPAIR",
  "repository": "owner/repository",
  "issue_number": "602",
  "pr_number": null,
  "branch": "fix/602-malformed-founder-decision-recovery",
  "exact_head": "0000000000000000000000000000000000000000",
  "protected_base": {
    "branch": "main",
    "sha": "0000000000000000000000000000000000000000"
  },
  "policy": {
    "path": "docs/mission-control/mission-control-guide.md",
    "policy_id": "bemoat-mission-control",
    "version": "1.6.0",
    "source_sha": "0000000000000000000000000000000000000000"
  },
  "source_founder_gate": {
    "comment_id": "1234567890",
    "url": "https://github.com/owner/repository/issues/602#issuecomment-1234567890"
  },
  "decision": "PROCEED",
  "authority": {
    "role": "FOUNDER",
    "login": "founder-login"
  },
  "source_founder_decision": {
    "comment_id": "1234567891",
    "url": "https://github.com/owner/repository/issues/602#issuecomment-1234567891",
    "body_sha256": "0000000000000000000000000000000000000000000000000000000000000000"
  }
}
```
````
<!-- founder-decision-repair:example:end -->

Run registered CLI Discovery and validate the complete candidate body:

    pnpm run bemoat:founder-decision-repair:validate -- --help --json
    pnpm run bemoat:founder-decision-repair:validate -- --body-file ./founder-decision-repair.md --json

PASS proves syntax only. It verifies no live identity, Founder authority,
predecessor digest, policy, gate, or other Context evidence and publishes
nothing. The trusted Founder publishes exactly one authorized repair, preserving
the predecessor and gate. Rerun fresh Context after publication. A valid repair
consumes only that exact gate and allows ordinary remaining-evidence
recomputation. It grants no generic authority, does not resolve STOP blockers,
and cannot supersede arbitrary history or affect active-PR gates. Malformed,
duplicate, competing, changed-body, stale, or wrong-bound evidence stays STOP.
