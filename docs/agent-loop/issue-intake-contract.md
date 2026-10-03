# Issue Intake Contract

Use this contract when ChatGPT creates or updates a GitHub issue from an active
conversation. The goal is to normalize issue structure without expanding scope.

Principle: `Normalize structure, not expand scope`.

## When to use this

Use this guide when:

- a brainstorm conversation is ready to become a GitHub issue
- an existing issue needs to be rewritten into a clearer implementation slice
- an agent or human wants a canonical issue structure before coding starts

Do not use it to add requirements the user did not choose, create exhaustive
specification documents, or split one task into multiple future phases unless
the current conversation already decided that.

## Canonical issue format

Every Issue intended for Mission Control execution must also carry these two
plain-text declarations in its final body, outside fenced examples:

```text
Task size: small | medium | core
Mission Control mode: required | optional | not required | unsure
```

Use exactly one supported value for each declaration. The production Context
parser remains authoritative: missing or unrecognized values do not create an
executable workflow profile. `not required` follows the parser's existing
optional-mode behavior; `unsure` uses STANDARD safeguards. Do not infer or
invent declarations from task prose.

This requirement applies whether the Issue is created or updated through the
GitHub form, a ChatGPT/GitHub connector, or the GitHub API. For programmatic
creation, the agent must write both declaration lines directly into the Issue
body; GitHub form validation does not run on API-created Issues.

Write the issue using these sections when they are relevant:

```md
## Goal

The result this task should produce.

## Context

The current problem and why the task matters.

## Scope

- Work required in the active slice.

## Out of Scope

- Work intentionally deferred.

## Must Not Break

- Existing behavior, contracts, data, or flows that must remain unchanged.

## Acceptance Criteria

- [ ] Observable result that can be verified.

## Verification

- Automated checks
- Manual QA when needed

## Stop Condition

The point where this issue is complete without expanding into future work.
```

Sections with no meaningful content may be omitted. Do not add filler merely to
complete the template.

For Core or multi-stage work, also follow
[project-progress-tracking.md](./project-progress-tracking.md) and use the
`agent-task` template optional Main Issue / Implementation Plan fields or the
equivalent `Main Issue:` / `### Main Issue` declarations.

## Normalization rules

When converting a conversation into an issue, ChatGPT must:

1. Use only decisions supported by the current conversation and repository context.
2. Preserve the owner's latest decision when earlier discussion conflicts with it.
3. Separate the active slice from future ideas and rejected alternatives.
4. Remove conversational noise that does not affect implementation.
5. Never invent requirements to fill a section.
6. Normalize structure without expanding scope.
7. Keep acceptance criteria observable and testable.
8. Stop when the issue is clear enough to begin work; do not make it exhaustive.
9. Use the self red-team scope gate from [self-red-team-scope-gate.md](./self-red-team-scope-gate.md) when material planning or specification expansion is involved.

## ChatGPT Project Instructions

Copy and paste this into ChatGPT Project Instructions when the owner wants
conversation-to-issue output to follow this contract:

```text
When the user asks to create or update a GitHub issue from the current conversation:

1. Read `docs/agent-loop/issue-intake-contract.md` from the target repository when available.
2. For every Issue intended for Mission Control execution, put both required workflow declarations as plain text in the final body, outside code fences and examples:

   `Task size: <small | medium | core>`

   `Mission Control mode: <required | optional | not required | unsure>`

   Select values only from explicit conversation/repository evidence. Do not omit these declarations for API/connector-created Issues, and do not guess when the evidence is unclear; mark the mode `unsure` so Context applies STANDARD safeguards.
3. Summarize only decisions the user has actually made.
4. Do not add features, expand scope, or invent missing requirements.
5. Separate the active slice from future ideas and rejected alternatives.
6. Write the issue using this structure when relevant:

## Goal
## Context
## Scope
## Out of Scope
## Must Not Break
## Acceptance Criteria
## Verification
## Stop Condition

7. Omit sections that have no meaningful content. Do not add filler.
8. Before creating or updating the issue, check that:
   - the scope is clear,
   - acceptance criteria are observable,
   - future work is not mixed into the active slice,
   - the issue is not more detailed than needed to begin implementation.
9. Create or update the issue in the repository specified by the user.
10. After the action, report the issue title, number, and URL.

Principle: Normalize structure, not expand scope.
```

## Child sync impact

This file lives under `docs/agent-loop`, which is a harness-managed path in
`bemoat-web-starter`. After this starter change merges, child projects should
receive it through:

```bash
pnpm run bemoat:boilerplate:sync -- --harness-only
```

No new sync path is required.
