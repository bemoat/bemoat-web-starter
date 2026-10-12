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
   replace `bemoat:context`. It does not run live `gh` mutations or call
   `bemoat:handoff` with an issue payload.
3. **Capture:** Compare observations only with the canonical descriptive
   `docs/mission-control/flow-oracle.json`, its normalized fixture at
   `tests/fixtures/verify-harness-flow/oracle.json`, and canonical policy. Keep
   synthetic CLI/Git traces separate from native spawned-host evidence. The
   runner emits a sanitized trace in a newly created task-owned temporary
   evidence directory and retains it after synthetic cleanup.
4. **Cleanup:** Remove only the runner-created synthetic workspace after
   checking its ownership marker. Read back that the workspace is absent and
   the sanitized trace remains before reporting cleanup success. Never remove
   the original checkout, unrelated refs, or an evidence directory that this
   run did not create.

## Classifications

Use only the classification supported by the evidence:

- `PASS`: the bounded synthetic checks completed and cleanup was verified.
- `EXPECTED_STOP`: an authoritative public command or policy requires a stop.
- `DEFECT`: observed behavior contradicts an unambiguous canonical invariant.
- `SPEC_GAP`: more than one outcome remains plausible; record exclusions and
  stop without inventing a fallback.
- `UNREACHABLE`: the required host capability or native evidence is not
  available. A prose simulation is never spawned-host proof.

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
directory. It preserves the caller's checkout, dirty state, and unrelated refs.
The evidence directory is retained for review; its sanitized trace excludes
machine paths, environment values, and raw command output.
