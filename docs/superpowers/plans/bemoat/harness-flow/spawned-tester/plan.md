# Issue #643 — Spawned Harness Tester pilot

> **Execution note:** This plan is subordinate to fresh `bemoat:context 643`
> and the registered public CLI contracts. It does not grant route, approval,
> or mutation authority.

## Goal

Build one minimal, discoverable `.agents/skills/verify-harness-flow/` Skill and
the smallest isolated verification harness needed to prove (or honestly report
as unreachable) a genuinely spawned Tester, real registered Bemoat CLI use,
independent oracle comparison, synthetic A→B→C→D trials, F01–F06 negative
classification, defect/correction/retest boundaries, and Doctor → Drive →
Capture → Cleanup safety. Keep synthetic CLI evidence separate from native
spawned-host evidence.

## Global constraints

- Canonical policy, fresh `bemoat:context`, and registered CLI Discovery remain
  the only route and authority sources.
- The Skill and harness are verification-only; they must not implement a router,
  scheduler, permission engine, state ledger, simulated Founder approval, or
  pstack runtime cutover.
- All repositories, refs, remotes, evidence fixtures, traces, and cleanup
  targets are disposable resources owned by the test run. Never mutate live
  production GitHub, the original checkout, unrelated refs, or outside-owned
  paths.
- Expected `STOP`, `FOUNDER_GATE`, `SPEC_GAP`, and `UNREACHABLE` outcomes remain
  distinct from `PASS` and are never promoted by fallback logic.
- The controller is orchestration-only. The implementation worker is the sole
  mutation owner for the Skill/harness scope. The independent reviewer is a
  distinct identity from both controller and implementer.
- Use test-first proof for every new executable behavior. The oracle worker must
  author the independent expected/prohibited assertions before implementation.

## Planned files and ownership

- `docs/superpowers/plans/bemoat/harness-flow/spawned-tester/plan.md` — this
  execution plan and task boundaries.
- `tests/int/verify-harness-flow-oracle.int.spec.ts` — independent policy-backed
  characterization/oracle tests, owned by the oracle worker.
- `tests/fixtures/verify-harness-flow/oracle.json` — copied/normalized oracle
  projections and explicit `SPEC_GAP`/`UNREACHABLE` classifications, owned by
  the oracle worker.
- `.agents/skills/verify-harness-flow/SKILL.md` — discoverable Skill entrypoint,
  owned by the implementation worker.
- `.agents/skills/verify-harness-flow/playbooks/` — Doctor/Drive/Capture/Cleanup
  playbooks and trace contract, owned by the implementation worker.
- `.agents/skills/verify-harness-flow/fixtures/` — disposable synthetic fixture
  templates only, owned by the implementation worker.
- `.agents/skills/verify-harness-flow/run-verification.mjs` — minimal runner
  that invokes the public registered CLI and records sanitized traces, owned by
  the implementation worker.

## Tasks

### Task 1 — Characterize supported seams (read-only)

Inspect the native Skill/agent invocation interface available to the current
Codex host, pstack-style packaging constraints, public Bemoat CLI registry,
synthetic evidence seams, and existing isolation helpers. Report exact
supported/unreachable boundaries and a non-overlapping implementation contract;
do not edit repository files or invoke live GitHub mutation.

### Task 2 — Author independent oracle tests (RED)

Using the merged `flow-oracle.json`, policy, Story Matrix, and Issue #643
acceptance criteria as authority, write the independent fixture/oracle and
tests before implementation. Cover discovered public CLI help, mutation-free
Context/HANDOFF boundaries, per-objective A→B→C→D authorization, F01–F06
classification rules, isolation/cleanup, and explicit `SPEC_GAP`/
`UNREACHABLE` handling. Run the focused tests and record the expected RED
failures; do not derive expected outcomes from implementation behavior.

### Task 3 — Implement the minimal Skill and harness (GREEN)

Implement only the files in the implementation ownership list. Make the Skill
discoverable through the supported native host interface, invoke only registered
public commands, create/own disposable synthetic resources, capture sanitized
traces, preserve original WIP, and classify observations against the independent
oracle. No live GitHub writes, no Context replacement, and no auto-correction
outside an explicitly authorized fixture boundary.

### Task 4 — Deterministic verification

Independently run the focused oracle tests, repeatable synthetic trials, F01–F06
fault injections, cleanup and filesystem/ref ownership assertions, and the
repository-required validation tier. Separately invoke the Skill through the
native spawned-agent interface and retain host-continuity evidence distinct from
CLI fixture traces. Report PASS, EXPECTED_STOP, DEFECT, SPEC_GAP, or
UNREACHABLE with exact route/action, side effects, blocker, and owner.

### Task 5 — Correction/retest boundary (conditional)

If the Tester detects a reproducible in-scope harness defect, report it to the
controller; only the implementation worker may receive a bounded correction
assignment, after which the Tester independently retests. If the host or
adapter cannot lawfully support this loop, record the precise UNREACHABLE or
EXPECTED_STOP cause and do not invent a correction.

### Task 6 — Independent semantic review and delivery gates

A distinct semantic reviewer audits oracle independence, native spawn proof,
CLI/fixture separation, negative gates, cleanup, acceptance evidence, and scope.
Resolve findings through the implementation worker only. Then commit proven
units, push and read back exact SHAs, audit C01–C07, open/update one PR if
authorized, publish the required strict HANDOFF, and rerun fresh Context. Never
merge autonomously.

## Validation commands

- Focused: `pnpm run bemoat:test:int -- tests/int/verify-harness-flow-oracle.int.spec.ts`
- Required code tier: `pnpm run bemoat:check`
- Registered discovery: `pnpm run bemoat:context -- --help --json`
- Fresh context: `pnpm run bemoat:context 643 --json`
- Final safety: `git status --short --branch`, exact local/upstream/live SHA
  readback, and sanitized trace inventory.

## Risks and rulings

- **Ruling:** Treat the merged F01–F06 `SPEC_GAP` records as exclusions and
  evidence requirements, not expected route fallbacks. This preserves the
  oracle's stated independence and costs concrete scenario mapping until native
  evidence resolves it.
- **Ruling:** Use the repository's existing CLI boundary harness and approved
  synthetic evidence seams rather than adding a new runtime adapter. This keeps
  the pilot bounded and avoids a second authority engine.
- Native host Skill discovery or spawned-agent continuity may be unavailable;
  such a result is an honest `UNREACHABLE`, not a Tester PASS.
