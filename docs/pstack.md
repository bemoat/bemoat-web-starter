# Pinned Cursor PStack consumption

Issue #561 makes the official Cursor PStack tree available as a deterministic,
task-local cache. It does not activate PStack, change Bemoat routing, or add a
second workflow authority.

## Approved pin

The checked-in `.bemoat/pstack-pin.json` is the source of truth for the
consumed tree:

- repository: `cursor/plugins`
- subtree: `pstack`
- exact commit: `88d47514b82e7c44f00f2b2a72ff6dd12158038c`
- plugin version: `0.15.29`
- expected PStack tree and manifest blob hashes: recorded in the pin file

The cache lives at `.bemoat/pstack-cache/`. It is ignored by Git and belongs to
the checkout that installed it.

## Install from a clean checkout

After cloning or checking out this repository, install dependencies as usual,
then explicitly install the pinned cache:

```bash
pnpm install --frozen-lockfile
pnpm run bemoat:pstack -- install
```

Install fetches the exact commit, checks the commit, subtree tree, manifest
blobs, declared version, origin, and clean worktree, and removes a newly
created cache if verification fails. An existing non-empty cache is verified
and never overwritten when it does not match the pin. Use an explicit cache
directory when working in a disposable task-local location:

```bash
pnpm run bemoat:pstack -- install --cache-dir /private/tmp/my-pstack-cache
```

The install operation only writes the selected cache. It does not copy files
into `.agents`, modify Cursor settings, or change any Bemoat configuration.

## Read-only verification and discovery

Check a cache without changing it:

```bash
pnpm run bemoat:pstack -- check
```

Discover the pinned skill and agent names without executing them:

```bash
pnpm run bemoat:pstack -- discover
```

Both commands validate the exact commit and integrity hashes, require a clean
cache worktree, report `automatic_routing: false`, and perform no mutation.
Discovery is an inventory only; it does not load, invoke, or enable a PStack
skill or agent.

## Updating or rolling back the pin

An update is an explicit reviewed change, not a floating fetch:

1. Select a new exact upstream `cursor/plugins` commit.
2. Recalculate the PStack subtree and both manifest blob hashes, and update the
   version in `.bemoat/pstack-pin.json`.
3. Update the focused tests and this document if the contract changes.
4. Run the PStack tests and the starter sync/check validation, then review the
   exact diff in a normal PR.

To roll back, restore the previous pin, utility, documentation, and focused
test state in a reviewed commit, then remove and reinstall only the task-local
cache if it no longer matches:

```bash
rm -rf .bemoat/pstack-cache
pnpm run bemoat:pstack -- install
pnpm run bemoat:pstack -- check
```

No production resource, Payload schema, or migration is involved in this
cache update or rollback procedure.

## Routing, child sync, and runtime scope

`automatic_routing` remains `false`. Bemoat Context, Handoff, STOP,
FOUNDER_GATE, review, exact-head, and merge authority remain unchanged. This
issue only prepares starter-owned consumption metadata. It does not propagate
changes into child repositories; a child receives these paths only through its
normal harness sync after the starter change is reviewed and merged.

Issue #561 does not verify behavior inside a native Cursor runtime. Its proof
is limited to the pinned Git cache, integrity checks, read-only discovery, and
the non-activation contract. Native Cursor execution and any future routing
integration require a separate, explicitly authorized change.
