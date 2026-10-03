# Regression Skill

Use this before reporting that work is complete, fixed, or ready for review
when native verification skills are unavailable.

## Evidence Rule

Do not claim work is complete without fresh verification evidence. Run the
command that proves the claim, read the output, and report the actual result.

## Checklist

### Semantic test oracles

Derive each semantic test oracle from canonical authority, never from the
candidate implementation. Record the authority and the behavior it establishes
before writing the assertion.

- Assert a specific expected route/state/outcome only when canonical authority
  uniquely determines it.
- If authority only forbids an outcome, assert that exclusion; do not invent a
  fallback outcome.
- If multiple outcomes remain plausible from canonical authority, classify the
  case as a protocol/spec gap and stop before encoding one as expected behavior.
  An authority-backed exclusion remains valid; it does not resolve the gap or
  authorize choosing a fallback.

Follow `AGENTS.md#story-first-semantic-testing` and
`docs/agent-loop/context-story-matrix.md` for baseline characterization and the
existing implementation defect / missing coverage / protocol/spec gap classes.
This engineering rule does not change Mission Control authority or routing.

## Independent intermediate test-authoring pass

For a change that can alter deterministic or safety-relevant semantics, put an
independent test-authoring pass between implementation and final semantic
review. This is part of the same bounded objective and does not require a
Global MC round-trip. Trigger it for changes to routing, evidence
interpretation, workflow or guard behavior, access control, schema or migration
safety, or reusable harness behavior where an incorrect assertion could bless
an incorrect implementation. Skip it for copy-only changes, trivial styling,
mechanical renames, and routine low-risk work whose behavior is already
mechanically verified without semantic ambiguity.

The intermediate tester must be a different worker/session from the
implementation owner. Before writing or changing assertions, read the canonical
Issue, relevant authority, and current diff/tests. Treat the candidate
implementation as something to challenge, not as the source of expected
behavior. Inspect whether existing tests over-specify, under-specify, or merely
mirror the implementation. Use the authority-bound oracle rules above. If
canonical authority does not uniquely support an expected outcome, report a
protocol/spec gap instead of inventing a green assertion.

The tester may change only test/fixture paths explicitly permitted by the
active objective, and must not edit production implementation files. Add or
adjust the smallest bounded, authority-backed regression that can expose a real
gap. If it fails against the implementation, return correction ownership to
the accountable controller/implementer; the tester does not repair production
code. Keep the final independent semantic/Delta review as a later boundary,
performed by a reviewer distinct from both the controller/implementer and the
intermediate tester. This pass adds no Mission Control route, state, or evidence
vocabulary and does not cross Founder or STOP gates.

### Change impact

Ask whether the change affects:

- App runtime behavior.
- Payload schema, generated types, or migrations.
- Payload admin components or import maps.
- Cloudflare Workers, D1, R2, bindings, environments, or deploy commands.
- Boilerplate sync, harness assumptions, CI, or git hooks.
- Child project compatibility.
- Agent rules, fallback skills, or editor behavior.
- UI animation, Framer Motion choreography, slow-motion QA, reduced-motion behavior, or perceived continuity.

## Validation Selection

- Follow `AGENTS.md#validation-before-pr-and-merge`.
- Docs-only changes: starter `pnpm run guard:safety`; child
  `pnpm run bemoat:guard:safety`.
- Sync or harness docs: in child projects also run
  `pnpm run bemoat:boilerplate:check -- --harness-only` when available.
- Code changes: starter `pnpm run check`; child `pnpm run bemoat:check` when
  supported, otherwise `bemoat:guard:safety`, `bemoat:test:int`, and
  child-owned code checks.
- Payload schema or admin changes: run the matching code tier, then starter
  `generate:types` / `generate:importmap` or child-owned generation scripts
  when present.

## Motion QA Reporting

For non-trivial UI animation work, report:

- Normal-speed visual QA result.
- Slow-motion QA result when timing or continuity is unclear.
- Reduced-motion behavior.
- Changed animation selectors or components.
- Remaining motion risks, especially blink, pop, snap, jank, or same-object identity loss.

## Report Format

Include:

- Commands run.
- Pass or fail result for each command.
- Known gaps.
- Manual checks still needed.
- Remaining risk.
