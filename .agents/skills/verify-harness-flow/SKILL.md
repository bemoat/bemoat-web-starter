---
name: verify-harness-flow
description: Verify a bounded Bemoat harness flow using registered CLI contracts, an independent oracle, and owned synthetic resources.
---

# Verify a Bemoat harness flow

Use this project-local Skill to check one bounded harness objective. It is a
verification adapter, not a router or authority engine. Fresh registered CLI
Discovery and `bemoat:context` remain authoritative. This Skill never replaces
Context, grants approval, schedules another objective, or turns a protocol gap
into a route.

## Doctor → Drive → Capture → Cleanup

1. **Doctor:** Read `AGENTS.md` and the applicable agent-loop guidance. Resolve
   each Bemoat command through registered public CLI Discovery. For commands
   with `help_meaningful: true`, invoke the registered `safe_help_invocation`
   and check its machine-readable contract before any retained invocation.
   The runner invokes only safe Context and Handoff help; it does not invoke a
   workflow action.
2. **Drive:** Run the bounded harness:

   ```sh
   node .agents/skills/verify-harness-flow/run-verification.mjs
   ```

   It exercises disposable local Git repositories and a contained synthetic
   observation fixture. Synthetic evidence is never supplied to or used to
   replace `bemoat:context`. The real Context help contract is inspected and
   records live GitHub reads plus `--target-worktree`; because it exposes no
   controlled synthetic GitHub evidence adapter, the A/B/C/D trials and C02–C05
   are `UNREACHABLE` with null route/action, a blocker, and an owner. The
   runner does not claim scenario `PASS`, run live `gh` mutations, or call
   `bemoat:handoff` with an issue payload.

   The Issue #643 runner above intentionally preserves the legacy native-host
   characterization: its Context adapter boundary is `UNREACHABLE`. The
   Issue #648 campaign runner is a separate test-only path:

   ```sh
   node .agents/skills/verify-harness-flow/run-synthetic-context.mjs
   ```

   It invokes the registered public `bemoat:context` and `bemoat:handoff`
   commands inside an owned disposable clone with the explicit synthetic
   evidence adapter enabled. Its `SUPPORTED` capability describes only that
   controlled adapter boundary; it does not replace native Context or change
   production routing. The runner owns the fixture and comment state, proves
   that the poison `gh` executable is never invoked, preserves F01–F06 as
   `SPEC_GAP` with null oracle route/action expectations, and keeps the
   spawned-host tier separately `UNREACHABLE`.
3. **Capture:** Compare observations only with the canonical descriptive
   `docs/mission-control/flow-oracle.json`, its normalized fixture at
   `tests/fixtures/verify-harness-flow/oracle.json`, and canonical policy. Keep
   synthetic CLI/Git traces separate from native spawned-host evidence. The
   runner emits a sanitized trace in a newly created task-owned temporary
   evidence directory and retains it after synthetic cleanup. It captures
   exact before/after head, branch, upstream, refs, and WIP snapshots for the
   original checkout and compares them before reporting preservation.
4. **Cleanup:** Remove only the runner-created synthetic workspace after
   checking its ownership marker. Read back that the workspace is absent and
   the sanitized trace remains before reporting cleanup success. Never remove
   the original checkout, unrelated refs, or an evidence directory that this
   run did not create.

## Classifications

Use only the classification supported by the evidence:

- `PASS`: only an individual bounded setup check, such as local Git roundtrip,
  completed successfully; it does not mean the A/B/C/D scenario passed.
- `EXPECTED_STOP`: an authoritative public command or policy requires a stop.
- `DEFECT`: observed behavior contradicts an unambiguous canonical invariant.
- `SPEC_GAP`: more than one outcome remains plausible; record exclusions and
  stop without inventing a fallback.
- `UNREACHABLE`: the required host capability or native evidence is not
  available. A prose simulation is never spawned-host proof.

For the legacy #643 `run-verification.mjs` runner, the Context adapter boundary
remains an explicit `UNREACHABLE`: the registered command reads live GitHub
evidence and accepts a target worktree, but that runner has no controlled
synthetic GitHub evidence adapter. Its A/B/C/D and C02–C05 records therefore
stay `UNREACHABLE`, with null route/action, the exact blocker, and
`bemoat:context CLI adapter owner`.

The separate #648 `run-synthetic-context.mjs` runner is the supported Tier-1
test-only path. Its adapter is active only when `NODE_ENV=test`,
`BEMOAT_TEST_EVIDENCE_ENABLE=1`, `BEMOAT_TEST_EVIDENCE_ROOT` is an absolute
owned run root, and `BEMOAT_TEST_EVIDENCE_FIXTURE` is an owned non-symlinked
fixture beneath that root with the matching owner marker. Without that exact
opt-in, the public commands delegate to their native runners unchanged.

The oracle's F01–F06 records remain `SPEC_GAP` with null expected routes and
actions unless actual native authority resolves them. The spawned-host record
remains `UNREACHABLE` unless distinct native continuity evidence exists. A
synthetic runner `PASS` does not change either classification.

## Evidence and ownership

Keep each objective independently authorized. A result or HANDOFF is evidence,
not permission for the next objective; obtain fresh Context and the required
authority before continuing. Never issue live GitHub mutation commands, create
production comments/issues/PRs, merge, or call `bemoat:handoff` against
production from this Skill. Do not auto-correct observed behavior. Any
correction must be separately and explicitly assigned to the implementation
owner, bounded to an owned fixture, then independently retested.

The runner owns only resources it creates beneath its unique temporary run
directory. It preserves the caller's checkout, dirty state, and unrelated refs;
the trace includes exact sanitized before/after snapshots and their equality
comparison. The evidence directory is retained for review; its sanitized trace
excludes machine paths, environment values, and raw command output. The
`trace_retained` field is set only after the final trace content is durably
written and read back.
