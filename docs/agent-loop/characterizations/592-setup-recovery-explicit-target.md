# Issue #592 setup recovery target-mode characterization

## Canonical authority

- Issue #592 acceptance criteria and Required Invariants require a current exact-live protected-main source to invoke the registered recovery command against one explicit stale target. This source-target path must reuse the existing setup recovery operation and grant no objective authority.
- `docs/mission-control/execution-handoff-contract.md`, “Clean stale protected-base setup recovery,” binds the target recovery to an exact open Issue, canonical repository, protected base, and expected local head; it requires fetch-to-`FETCH_HEAD`, strict ancestry, `merge --ff-only` to the exact SHA, compare-and-swap tracking-ref advancement, exact readback, and a fresh Context next action.
- The same contract's Bridge B and source-target contracts require the command source to be the clean exact-live protected-main checkout and the target to be independently canonical, attached, clean, and bound. Source and target may be separate worktrees/clones; a shared Git common directory is not required.
- The registered `bemoat:context:recover-setup` command contract currently binds only one `cwd`; target mode must take the Issue and exact repository/base/head values from caller-supplied read-only target evidence, then re-collect and validate target Context internally. Same-worktree recovery is existing behavior and must remain unchanged.

## Risk-relevant stories

1. **Explicit target parsing:** the registered command accepts exactly one absolute `--target-worktree <absolute-path>` and retains all exact binding flags. Its help identifies this optional path mode. Relative or repeated targets are rejected before Git mutation.
2. **Eligible target:** the exact-live protected-main source and a separate clean attached target with canonical origin and protected-branch upstream may run the existing recovery core at the target root. Success reaches only the exact bound SHA and routes `STOP` to fresh `bemoat:context`, with no objective authority.
3. **Source drift or invalidity:** stale, dirty, wrong-origin, wrong-root, or wrong-branch source is rejected before target fetch or merge. Source and target identities and live base/head bindings are revalidated at each mutation boundary.
4. **Target invalidity/drift:** dirty, detached, wrong-origin/branch/upstream, local-only/divergent, ambiguous/moved base, or head drift cannot reach fast-forward. Existing recovery core cases remain authoritative for target recovery semantics.
5. **Compatibility:** omitting `--target-worktree` preserves #585 same-worktree behavior. This change does not alter #571 `sync-base` or #569 Context bootstrap semantics.

## Baseline classification

The absence of a supported explicit source-target path is an **implementation defect**: Issue #592 explicitly requires one reachable invocation while the stale target's local command source predates the emitter. The existing recovery core already establishes the target mutation safety contract; only the registered command boundary needs to make it reachable.
