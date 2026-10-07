# FOUNDER_DECISION template

Copy the complete fenced comment body below only after fresh Context returns
the exact no-PR `FOUNDER_GATE`. Replace every sample value with live evidence
from that gate, the current protected base, and the current merged policy.
Post exactly one comment as the trusted Founder. Never publish these sample
values.

````text
## FOUNDER_DECISION

```json
{
  "schema_version": 1,
  "record_type": "FOUNDER_DECISION",
  "repository": "bemoat/bemoat-web-starter",
  "issue_number": "587",
  "pr_number": null,
  "branch": "fix/587-founder-gate-consumption",
  "exact_head": "0000000000000000000000000000000000000000",
  "protected_base": {
    "branch": "main",
    "sha": "0000000000000000000000000000000000000000"
  },
  "policy": {
    "path": "docs/mission-control/mission-control-guide.md",
    "policy_id": "bemoat-mission-control",
    "version": "1.5.0",
    "source_sha": "0000000000000000000000000000000000000000"
  },
  "source_founder_gate": {
    "comment_id": "1234567890",
    "url": "https://github.com/bemoat/bemoat-web-starter/issues/587#issuecomment-1234567890"
  },
  "decision": "PROCEED",
  "authority": {
    "role": "FOUNDER",
    "login": "bemoat"
  }
}
```
````

The published comment must use `## FOUNDER_DECISION` followed by exactly one
canonical `json` fence containing the strict schema-v1 object. Do not add
timestamps, prose-based decisions, extra keys, or an author-association claim.
The native comment ID and URL must identify the decision comment itself; the
record's `source_founder_gate` must identify the separate exact gate comment.
Only `PROCEED` is supported. The decision removes only that exact gate from
Context's no-PR recomputation and grants no generic mutation authority.
