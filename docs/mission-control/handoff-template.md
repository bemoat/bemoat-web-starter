# HANDOFF template

Publish exactly one strict JSON object after fresh Context reconstruction and
one bounded objective:

```bash
pnpm run bemoat:handoff <issue-number> --body-file <strict-handoff.json>
```

The body must contain exactly one strict JSON HANDOFF object with the fields
below. Use schema-v2 for ordinary routes and schema-v3 for a new STOP.
Markdown, fenced
JSON, stdin, unknown fields, and multiple records are rejected.

```json
{
  "schema_version": 2,
  "objective_mode": "implementation",
  "record_type": "HANDOFF",
  "repository": "owner/repository",
  "issue_number": "410",
  "objective": "One bounded objective",
  "permitted_scope": ["Authorized paths or behavior"],
  "prohibited_scope": ["Explicit exclusions"],
  "executing_agent": "agent identity",
  "provider": "provider identity",
  "branch": "chore/410-example",
  "exact_head": "0123456789abcdef0123456789abcdef01234567",
  "protected_base": {
    "branch": "main",
    "sha": "89abcdef0123456789abcdef0123456789abcdef"
  },
  "pr": {
    "number": "455",
    "url": "https://github.com/owner/repository/pull/455",
    "base": "main",
    "head": "chore/410-example",
    "head_sha": "0123456789abcdef0123456789abcdef01234567"
  },
  "verified_evidence": [
    {
      "kind": "focused-tests",
      "value": "Focused tests passed",
      "url": null
    }
  ],
  "route": "FOUNDER_GATE",
  "next_action": {
    "route": "FOUNDER_GATE",
    "description": "Founder reviews the verified exact head; no autonomous merge"
  },
  "stop_conditions": ["Do not merge without Founder approval"],
  "local_durability": {
    "required": true,
    "durable": true,
    "reason": null
  }
}
```

`objective_mode` is `implementation` or `read_only`. Read-only records must set `pr` to `null`; the runtime verifies that no applicable active PR exists and that the protected-base-to-HEAD diff is empty before running `pnpm run bemoat:guard:safety`.

For a new STOP, set `schema_version` to `3`, set both `route` and
`next_action.route` to `STOP`, and include one `verified_evidence` entry of kind
`stop-blocker` for each independently resolvable blocker. Each entry has a
unique ID in `value` and `url: null`. Keep `stop_conditions` as guardrails;
they are not blocker IDs. The public writer rejects schema-v2 STOP input.
Context reads older schema-v2 STOPs only when their immutable identity is
listed in merged protected-base policy.

Example `verified_evidence` and route fields for a new STOP (use them in the
complete object above):

```json
{
  "schema_version": 3,
  "verified_evidence": [
    { "kind": "stop-blocker", "value": "missing-founder-decision", "url": null },
    { "kind": "stop-blocker", "value": "conflicting-native-evidence", "url": null }
  ],
  "route": "STOP",
  "next_action": {
    "route": "STOP",
    "description": "Resolve each named blocker through authorized durable evidence"
  }
}
```

This fragment illustrates replacements; the body file must still contain every
required field from the complete HANDOFF object.

The runtime derives the required validation tier from authoritative changed-file evidence and runs the matching repository command before publishing. It removes any caller-supplied `validation-proof` entry and adds one runtime-generated proof containing `status`, `tier`, `command`, and `exact_head`. Do not write or claim this proof in the input record.

Routes are closed to `IMPLEMENT`, `VERIFY`, `FIX`, `REVIEW`,
`FOUNDER_GATE`, `COMPLETE`, and `STOP`. When there is no branch or PR, use
`null` only where the schema permits it. If local durability is required but
incomplete, set `durable` to `false`, explain why in `reason`, and use an
appropriate STOP route.

The receiver must run `bemoat:context <issue-number> --json` and rebind live
evidence before acting. HANDOFF records authority and routing; it does not
create managed state, review counters, merge permission, or another protocol
transport.
