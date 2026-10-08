# Agent checklists

Use with [README.md](./README.md), [source-of-truth.md](./source-of-truth.md), and [security-and-migrations.md](./security-and-migrations.md).

Agents run the [Default Agent Workflow](../../AGENTS.md#default-agent-workflow) by default when the user provides only a task. Do not wait for explicit branch, commit, push, or PR instructions unless the user overrides the workflow.

## Task-size tiers

Classify work **before editing** and use the minimum useful process for that tier. This rule applies **going forward only** — do not retroactively clean up or re-label old commits.

Prefer updating these docs over creating new templates or workflows.

| Tier | Examples | Minimum artifacts |
|------|----------|-------------------|
| **Small** | Typo, copy, spacing, rename, one-file low-risk refactor | Commit message reason + relevant validation tier |
| **Medium** | New reusable component, section, CMS block, layout pattern, or design-reference conversion | Short brief, changed scope, diff reason, checklist, design reference source when relevant |
| **Core** | Architecture, design system, Payload schema, sync behavior, CI, guards, migrations, agent rules, or anything reused across child projects | Full task brief, diff reason, agent boundary, feature checklist, regression result, source-of-truth / child-sync impact |

**Small** tasks still follow branch gates and PR workflow; they do not need a full architecture brief.

**Medium** tasks document *what* changed and *why* in the PR; link Mobbin, Figma, or other design references when the task is design-related.

**Core** tasks add explicit boundaries (what is in/out of scope), checklist evidence, validation results, and whether child projects need harness sync (`pnpm run bemoat:boilerplate:sync -- --harness-only`) after merge.

For Core or multi-stage initiatives, use the Main GitHub Issue checklist as the durable project-stage tracker and the Implementation Plan as the roadmap contract. See [project-progress-tracking.md](./project-progress-tracking.md). Use `.superpowers/sdd/progress.md` for temporary local/session progress only.

The current supported workflow for every tier is `bemoat:context` → one bounded
objective → `bemoat:handoff` → fresh GitHub reconstruction. It does not create
or require local workflow state. Older managed-state records, when encountered,
are read-only migration evidence and cannot select new work.

When planning or specification expansion is material, use the
[self red-team scope gate](./self-red-team-scope-gate.md) before adding another
planning pass or requesting High Reasoning. Keep it optional and lightweight for
Small tasks with clear acceptance criteria.

When unsure, round **up** one tier for source-of-truth or sync-managed paths; round **down** for clearly local, low-risk edits.

## Durable semantic checkpoints

During normal execution, make one commit for each coherent, independently
understandable semantic unit when that unit has the focused proof needed to
show it works. Then push promptly and read back the remote task ref to confirm
it contains that exact commit SHA. A commit is a restart-safe progress record;
the final PR head remains the exact head for full CI and review.

Choose boundaries by meaning and recovery value, not by file, function,
assertion, line count, or elapsed time. Documentation/specification, valid
characterization, implementation, separable refactoring,
integration/registration, and forward corrections can each be a checkpoint
when independently reviewable. Directly coupled tests and proof normally travel
with the semantic change they establish. Keep intermediate commits valid,
buildable, and testable when practical. Do not leave a knowingly broken
red-test-only commit merely to separate a regression from its fix unless the
repository explicitly supports that form.

The first durable task commit must be pushed promptly. Push and verify the
exact remote SHA after every semantic checkpoint, and before waiting on long
CI/review or external work, a human/Founder gate, agent/session handoff,
planned shutdown, or declaring STOP/BLOCKED/RESULT/COMPLETE. A local commit
without remote readback is not a durable checkpoint. If meaningful task-owned
work accumulates for roughly 15 minutes without a useful boundary, reassess the
slice; use a WIP recovery checkpoint only when interruption risk is material
and no clean semantic checkpoint is available.

If a push fails or readback cannot prove the exact remote SHA, the checkpoint
is not yet durable. Do not treat it as a completed milestone; report the local
SHA and blocker and follow the repository's current STOP and exit-hygiene
guidance. Existing pre-exit and interruption handling continues to use the
current [Handoff exit-hygiene gate](../../.agents/skills/handoff.md#exit-hygiene/finalization-gate)
and Mission Control rules. These normal-path checkpoints add no second WIP
protocol. A WIP recovery commit, when allowed by current policy, is durable
evidence rather than completed delivery, review eligibility, or merge
authority.

Checkpoint commits do not create another PR per sub-objective or additional
Founder/review gates. Preserve the one bounded implementation PR, exact-head CI
and review, existing STOP/FOUNDER_GATE rules, and the prohibition on autonomous
merge, deploy, or migration authority. Never rewrite already-published
checkpoints just to reduce commit count.

## Before coding

- [ ] Started with `superpowers:using-superpowers`
- [ ] Read `AGENTS.md` and this folder
- [ ] Understood the task; confirmed no user override (e.g. "do not commit")
- [ ] **Task-size tier classified** (small / medium / core) — see [Task-size tiers](#task-size-tiers)
- [ ] Confirmed correct repo: **starter** vs **child project**
- [ ] Read issue/PR goal, acceptance criteria, allowed and forbidden paths
- [ ] If GitHub URL, issue, PR, branch, or CI run is referenced: inspected via GitHub skill or `gh`
- [ ] **`git status` run**; current branch confirmed
- [ ] **Working tree clean** (or stop and report unrelated dirty changes — no file edits)
- [ ] **Not on `main` or routine-coding on `dev`** for issue-based work — dedicated issue branch created first ([issue-driven-branch-workflow.md](./issue-driven-branch-workflow.md))
- [ ] **First-time issue branch is durable before Context rerun** — exact
      zero-delta local/upstream/remote/base identity was published and read
      back through the canonical bootstrap; local-only or conflicting state
      remains `STOP`
- [ ] Issue branch follows `<type>/<issue-number>-<short-slug>` (e.g. `fix/41-opennext-build-contract`)
- [ ] Branch created from current `dev` when starting fresh, or from the
      documented bootstrap baseline if the repo has no `dev` branch yet
- [ ] After issue preflight passed, summarized goal, scope, out-of-scope work,
      files or areas to inspect, expected validation, and risks or assumptions
- [ ] Explicit user trigger received before editing files
- [ ] If planning/specification expansion is material, ran or explicitly skipped
      the self red-team scope gate with a short reason
- [ ] No plan to copy D1 IDs, R2 names, Worker names, `.env`, or secrets across projects
- [ ] Filled [state-template.md](./state-template.md) with task and objective

## During coding

- [ ] Minimal diff; match existing conventions
- [ ] Reusable work targets `bemoat-web-starter`; project-specific work stays in child repos
- [ ] Payload hooks pass `req` to nested operations
- [ ] Local API with `user` sets `overrideAccess: false`
- [ ] After admin component changes: starter `pnpm run generate:importmap`, or child-owned `generate:importmap` when present
- [ ] After Payload schema changes: starter `pnpm run generate:types`, or child-owned `generate:types` when present
- [ ] After D1 schema changes: `pnpm payload migrate:create` and review migration
- [ ] Update session state (files changed, last command, blockers)

## Before commit

Stop instead of committing if the task is ambiguous, forbidden files are required, checks fail for unrelated reasons, or secrets/Cloudflare IDs/production deploy are involved. See [security-and-migrations.md](./security-and-migrations.md).

**Migration files alone are not a stop** — use [migration-draft-pr.md](./migration-draft-pr.md): commit, push, and open a **draft** PR after checks pass.

- [ ] `git status` and diff summary shown
- [ ] Only allowed files changed
- [ ] **Security pre-commit:** no `.env*` files staged
- [ ] **Security pre-commit:** no secrets, tokens, or credentials in the diff
- [ ] **Security pre-commit:** no copied Cloudflare account IDs, D1 IDs, R2 names, or Worker names
- [ ] **Migration pre-commit:** destructive `up()` migration has `bemoat:destructive-migration-approved` or is additive-only (guard:safety must pass)
- [ ] **Validation tier applied** (see [AGENTS.md § Validation](../../AGENTS.md#validation-before-pr-and-merge)):
  - [ ] **Starter docs/markdown/CI only** (no code): `pnpm run guard:safety` passed
  - [ ] **Child docs/markdown/CI only** (no code): `pnpm run bemoat:guard:safety` passed
  - [ ] **Starter code changes**: `pnpm run check` passed (**required** — includes lint with **zero warnings**, typecheck, test:int, guard:safety)
  - [ ] **Child code changes**: `pnpm run bemoat:check` passed when the child supports its local `lint` and `typecheck` scripts; otherwise `pnpm run bemoat:guard:safety`, `pnpm run bemoat:test:int`, and the child-owned code checks that exist passed
- [ ] Each independently proven semantic unit has a focused commit and the task branch has been pushed and read back at the exact checkpoint SHA
- [ ] No unrelated refactors in the commit

## Before PR

- [ ] Acceptance criteria met
- [ ] Source issue acceptance criteria audited before PR creation/update and
      final reporting
- [ ] Each acceptance criterion marked `Done`, `Not done`, `Not applicable`,
      or `Waiting for CI / human review`
- [ ] Completed acceptance criteria include brief evidence, such as changed
      files, validation commands, command results, or explicit rationale
- [ ] Source issue checklist left unchanged unless the user explicitly asked
      for it to be edited
- [ ] Acceptance criteria audit included in the PR body and/or canonical Task
      Issue `## HANDOFF` per [role-handoff-contract.md](./role-handoff-contract.md)
- [ ] **Validation tier** same as before commit:
  - [ ] Starter docs-only → `pnpm run guard:safety`
  - [ ] Child docs-only → `pnpm run bemoat:guard:safety`
  - [ ] Starter code changes → `pnpm run check` (**required**)
  - [ ] Child code changes → `pnpm run bemoat:check` when supported; otherwise `pnpm run bemoat:guard:safety`, `pnpm run bemoat:test:int`, and existing child-owned code checks
- [ ] `pnpm run generate:types` if Payload schema changed in the starter, or the child-owned `generate:types` script if present in a child project
- [ ] `pnpm run generate:importmap` if admin components changed in the starter, or the child-owned `generate:importmap` script if present in a child project
- [ ] Branch pushed to origin
- [ ] Checked whether branch already has an open PR — **open new PR** or **update existing PR** (no duplicate)
- [ ] **Migration PR:** opened or kept as **draft** (`gh pr create --draft`); title prefix `[D1 Migration]`, `[Payload Migration]`, or `[DB Migration]`; body includes migration safety checklist — see [migration-draft-pr.md](./migration-draft-pr.md)
- [ ] **Migration PR:** did **not** mark ready for review, merge, auto-merge, production migration, production deploy, or destructive rollback
- [ ] PR opened or updated; template complete: goal, changes, source-of-truth impact, Payload impact, commands, test result, risk review
- [ ] Clear answer: does this belong in starter or a child project?
- [ ] Agent notes and [state-template.md](./state-template.md) updated for reviewers
      (local/session only; Task Issue handoffs use [role-handoff-contract.md](./role-handoff-contract.md))
- [ ] Canonical Task Issue `## HANDOFF` published with `bemoat:handoff` per
      [role-handoff-contract.md](./role-handoff-contract.md)
- [ ] [role-handoff-contract.md](./role-handoff-contract.md) manual validation checklist satisfied when acting on or posting handoffs
- [ ] User notified with: task summary, branch, files changed, commands run, test result, commit hash, PR URL, risks, human review needed
- [ ] **Did not merge** — merge is human-only

## Before issue closeout (workflow / source-of-truth changes)

Complete when the change affects agent docs, CI, sync scripts, guards, or harness contracts. See [issue-driven-branch-workflow.md](./issue-driven-branch-workflow.md#harness-sync-closeout-before-closing-the-issue).

- [ ] Decided whether child projects need harness sync after merge (`pnpm run bemoat:boilerplate:sync -- --harness-only` in child repos)
- [ ] Sync scripts, drift checks, or harness contract guards reviewed for impact
- [ ] `boilerplate:check` / `bemoat:boilerplate:check` behavior documented or updated if needed
- [ ] Follow-up sync issue created and linked **or** sync completed — do not close source issue until resolved
- [ ] PR status clear before marking issue done

## Child harness sync (after starter merge)

Run in **child repos** only. Full loop: [harness-sync-workflow.md](./harness-sync-workflow.md).

- [ ] Confirmed child repo (not `bemoat-web-starter`)
- [ ] **`git status` run**; working tree clean (or stop and report)
- [ ] **Not on `main` or routine-syncing on `dev`** — sync branch created first: `chore/sync-harness-from-starter-<source-pr-number>`
- [ ] Starter source PR or tag identified
- [ ] `pnpm run bemoat:boilerplate:sync -- --harness-only` run on sync branch (or `pnpm run boilerplate:sync -- --harness-only` when the child defines the raw alias)
- [ ] `pnpm run bemoat:guard:safety` passed
- [ ] `git diff --check` passed
- [ ] `pnpm run bemoat:boilerplate:check -- --harness-only` run when available (or raw `boilerplate:check` only when the child defines that alias)
- [ ] Diff review: harness paths only; no product code, secrets, or Cloudflare IDs
- [ ] Branch pushed; PR opened or existing PR updated (no duplicate)
- [ ] Task Issue `## HANDOFF` posted when the child sync objective requires
      cross-agent transport; **did not merge**

## CI failure

- [ ] Open the failed GitHub Actions run—do not guess the cause
- [ ] Copy exact error lines into issue/PR or session state
- [ ] Fix only what the log indicates; avoid unrelated refactors
- [ ] Re-run failed command locally if possible
- [ ] Push fix and confirm CI re-run is green
- [ ] If failure is unrelated pre-existing: report exact output and stop broad fixes

## Merge readiness

- [ ] The current route was freshly reconstructed with `bemoat:context`; no
      managed-state block or review-cycle workflow is required for new work
- [ ] Applicable review evidence is verified on the exact PR head; historical
      review records are treated as migration evidence, and the next current
      route is published through `bemoat:handoff`
- [ ] **Pre-merge checklist reconciliation** — Audit Issue checkboxes against
      live verified evidence, update the body only when the evidence uniquely
      supports the edit, and otherwise record the mapped audit without changing
      the Issue body
- [ ] All required review threads resolved
- [ ] CI green on the PR branch
- [ ] Starter or child-local `pnpm run check:full` run when defined and practical before merge
- [ ] Migration and Cloudflare risks acknowledged in PR
- [ ] No sync-managed child edits that should have been upstreamed
- [ ] Squash/merge only after checks and review—not on failing CI

## Historical migration-only state compatibility

Older Issues may contain durable state blocks and review-cycle records. They
remain readable only to interpret or migrate historical evidence; they are not
a supported workflow, merge-readiness requirement, or routing option for new
work.
