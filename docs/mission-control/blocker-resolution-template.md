# BLOCKER_RESOLUTION publication template

Only the trusted Founder may publish a `## BLOCKER_RESOLUTION` Issue comment,
and only for one named blocker from an applicable exact-head STOP HANDOFF.
Copy the strict JSON example, replace every sample value with the matching
live evidence, and preserve the exact keys, value types, indentation, fence,
and final newline. Validate the completed body with the production parser
before publication. The native comment author and `authority.login` must both
match `trusted_founder_login` from the merged protected-base policy. A role
claim, `OWNER` association, or this template alone grants no authority.

The example is parser-tested syntax, not live resolution evidence. Bind every
field to the same repository, Issue, active PR, exact head, approved base,
policy, source STOP HANDOFF, blocker, and Founder identity. Do not add fields,
omit fields, publish duplicate/competing records, or infer authority from
timestamps or comment order.

<!-- blocker-resolution:example:start -->
## BLOCKER_RESOLUTION

```json
{
  "schema_version": 1,
  "record_type": "BLOCKER_RESOLUTION",
  "repository": "owner/repository",
  "issue_number": "535",
  "pr_number": "9002",
  "exact_head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "protected_base": {
    "branch": "main",
    "sha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  "policy": {
    "path": "docs/mission-control/mission-control-guide.md",
    "policy_id": "bemoat-mission-control",
    "version": "1.3.0",
    "source_sha": "cccccccccccccccccccccccccccccccccccccccc"
  },
  "source_stop_handoff": {
    "comment_id": "9005",
    "url": "https://github.com/owner/repository/issues/535#issuecomment-9005"
  },
  "blocker_id": "missing-founder-decision",
  "authority": {
    "role": "FOUNDER",
    "login": "founder-login"
  }
}
```
<!-- blocker-resolution:example:end -->

The strict schema and blocker semantics are defined in
[command-reference.md](command-reference.md#stop-blocker-resolution-evidence).
