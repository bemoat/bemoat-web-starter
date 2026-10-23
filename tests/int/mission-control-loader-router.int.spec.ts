import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const loaderPath = 'prompts/mission-control/chatgpt-project-loader.md'
const agentInstructions = readFileSync(resolve(root, 'AGENTS.md'), 'utf8')
const issueBranchWorkflow = readFileSync(resolve(root, 'docs/agent-loop/issue-driven-branch-workflow.md'), 'utf8')
const loader = readFileSync(resolve(root, loaderPath), 'utf8')
const normalizedLoader = loader.replace(/\s+/g, ' ')
const normalizedAgentInstructions = agentInstructions.replace(/\s+/g, ' ')
const normalizedIssueBranchWorkflow = issueBranchWorkflow.replace(/\s+/g, ' ')
const executionHandoff = readFileSync(resolve(root, 'docs/mission-control/execution-handoff-contract.md'), 'utf8')
const contextStoryMatrix = readFileSync(resolve(root, 'docs/agent-loop/context-story-matrix.md'), 'utf8')
const commandReference = readFileSync(resolve(root, 'docs/mission-control/command-reference.md'), 'utf8')
const normalizedExecutionHandoff = executionHandoff.replace(/\s+/g, ' ')
const normalizedContextStoryMatrix = contextStoryMatrix.replace(/\s+/g, ' ')
const normalizedCommandReference = commandReference.replace(/\s+/g, ' ')
const hasHardCodedSolMediumControllerDefault = (text: string) => text
  .split(/[.;]\s+/)
  .some((statement) => /\bSol\b/i.test(statement)
    && /\bMedium\b/i.test(statement)
    && (/\b(?:controller|accountable)\b/i.test(statement)
      || /\b(?:default|fallback|recommendation)\b/i.test(statement)))

describe('Global Mission Control progressive-disclosure router', () => {
  it('keeps only the always-required authority and routing in the loader', () => {
    // Allow the mandatory Section 8 reminder while keeping the progressive loader compact.
    expect(loader.length).toBeLessThanOrEqual(5350)

    for (const invariant of [
      /authoritative protected-base policy/i,
      /live GitHub/i,
      /report repository.*protected base.*policy ref.*policy source commit SHA.*guide version/i,
      /Global MC does not run repository-local Bemoat CLI/i,
      /Context.*canonical routing authority/i,
      /one bounded objective/i,
      /`COMMAND`.*continue.*same.*session/i,
      /`FOUNDER_GATE`.*return to Founder/i,
      /`STOP`.*fail.closed/i,
      /do not pre.authorize future objectives/i,
      /independent review/i,
      /no autonomous merge/i,
    ]) expect(normalizedLoader).toMatch(invariant)
  })

  it('keeps a fresh COMMAND result inside the active controller session', () => {
    expect(loader).toContain('- Execution handoff: load `docs/mission-control/execution-handoff-contract.md`')
    expect(normalizedExecutionHandoff).toMatch(/after that trigger has been satisfied, when fresh Context returns `next_action.type` as `COMMAND`, continue automatically with the authorized next separately bounded objective in the same controller session/i)
    expect(normalizedExecutionHandoff).toMatch(/do not end the active controller turn with a status-only response, return to Founder to relay the route, or ask for confirmation again after `COMMAND`/i)
  })

  it('preserves the first-edit trigger without asking again after later COMMAND results', () => {
    expect(normalizedLoader).toMatch(/Fresh Context selects each `IMPLEMENT`, `VERIFY`, `FIX`, and `REVIEW` objective.*one-time post-preflight implementation trigger remains required before the first source-file edit/i)
    expect(normalizedExecutionHandoff).toMatch(/the one-time post-preflight implementation trigger remains required before the first source-file edit after issue preflight.*a fresh `COMMAND` does not satisfy or waive that trigger/i)
    expect(normalizedExecutionHandoff).toMatch(/if it has not yet been given, return the bounded intent summary and wait for that trigger before editing/i)
    expect(normalizedExecutionHandoff).toMatch(/or ask for confirmation again after `COMMAND`/i)
    expect(normalizedExecutionHandoff).toMatch(/for `FOUNDER_GATE`, do not mutate and return to Founder once for the required decision/i)
    expect(normalizedExecutionHandoff).toMatch(/for `STOP`, unsupported state, or evidence conflict, do not mutate the authorized objective; stop fail-closed and report the exact blocker/i)
  })

  it('requires the fixed operator block before long artifacts', () => {
    const labels = [
      'Current objective',
      'Current route/status',
      'Suggested model',
      'Next action',
      'Founder decision',
      'Live identity',
    ]
    const positions = labels.map((label) => loader.indexOf(`**${label}:**`))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
    expect(normalizedLoader).toMatch(/exact concise operator block before any long artifact/i)
    expect(normalizedLoader).toMatch(/do not substitute a generic live-state bullet list/i)
    expect(normalizedLoader).toMatch(/Resolve Suggested model whenever model recommendations or an Execution handoff are triggered/i)
    expect(normalizedLoader).toMatch(/Require Next action in this pre-artifact block/i)
    expect((loader.match(/^ {0,3}```/gm) ?? []).length % 2).toBe(0)
  })

  // Oracle: Founder direction 6036218038 makes the loaded advisory profile the
  // source for generated handoffs; the loader must not encode a controller
  // model of its own. Check behavior and role/model separation, not one stale
  // example string.
  it('resolves an unoverridden controller from the profile without a stale Sol default', () => {
    const handoffRoute = loader.split('- Execution handoff:')[1]?.split('- Authorized objective/recovery:')[0] ?? ''

    expect(handoffRoute).toContain('docs/mission-control/model-routing-profile.md')
    expect(hasHardCodedSolMediumControllerDefault('Default model: Sol Medium')).toBe(true)
    expect(hasHardCodedSolMediumControllerDefault(normalizedLoader)).toBe(false)
    expect(normalizedExecutionHandoff).toMatch(/Luna XHigh advisory default.*explicitly selected.*actual controller/i)
  })

  // Oracle: Founder direction 5971335066 and the bounded checkout-recovery
  // clarification require operational guidance, not new Context routing.
  it('makes cross-session continuation executable after the human trigger', () => {
    expect(normalizedExecutionHandoff).toMatch(/existing active Execution\/IDE session for the same Issue.*when the session, workspace, and authority are still valid.*cross-session operator action is actually required/i)
    expect(normalizedExecutionHandoff).toMatch(/smallest canonical compact operator action, such as `continue`, in a self-contained copy-ready artifact in the same response/i)
    expect(normalizedExecutionHandoff).toMatch(/artifact itself MUST identify the repository, Issue, and exact next action, including that the authorized objective continues in this existing session/i)
    expect(normalizedExecutionHandoff).toMatch(/`continue` by itself or in surrounding prose is incomplete/i)
    expect(normalizedExecutionHandoff).toMatch(/if the current agent\/runtime can execute the authorized next action directly, perform it directly instead; do not manufacture a handoff merely to relay deterministic work/i)
  })

  it('requires no Founder action when the active controller must continue automatically', () => {
    expect(normalizedExecutionHandoff).toMatch(/NO ACTION REQUIRED — EXECUTION CONTINUES IN THIS SESSION.*Execution continues automatically in this same Execution session.*The Founder should not paste anything elsewhere or grant another approval/i)
  })

  it('keeps STOP recovery narrower than task or workflow mutation', () => {
    expect(normalizedLoader).toMatch(/`STOP`.*stop fail-closed for task\/source\/workflow mutation/i)
    expect(normalizedExecutionHandoff).toMatch(/switch grants no synchronization.*implementation.*future.objective authority/i)
    expect(normalizedExecutionHandoff).toMatch(/missing, ambiguous, conflicting, or unsupported recovery remains STOP/i)
    expect(normalizedExecutionHandoff).toMatch(/at `FOUNDER_GATE`, include no mutation-capable instructions or delegated mutation/i)
  })

  // Oracle: Founder comment 5972597691 says an explicit bounded recovery
  // decision authorizes only that recovery, without invented comment/HANDOFF/
  // persistence gates; the loader still requires evidence named by applicable
  // canonical contracts and keeps real safety gates intact.
  it('continues the exact approved recovery without inventing persistence evidence', () => {
    expect(normalizedExecutionHandoff).toMatch(/when an explicit bounded recovery decision has been satisfied, perform only its named recovery/i)
    expect(normalizedExecutionHandoff).toMatch(/do not invent a new comment, HANDOFF, or persistence requirement unless an applicable canonical contract requires it/i)
    expect(normalizedCommandReference).toMatch(/authorized Founder may append one `## BLOCKER_RESOLUTION` Issue comment for one named blocker in an applicable exact.head STOP HANDOFF/i)
    expect(normalizedLoader).toMatch(/load `docs\/mission.control\/command.reference\.md`.*when resolving a STOP blocker with BLOCKER_RESOLUTION/i)
    expect(normalizedExecutionHandoff).toMatch(/BLOCKER_RESOLUTION.*HANDOFF.*review.*merge.*destructive.*production.*migration.*secret.*STOP.*FOUNDER_GATE.*boundaries/i)
  })

  // Oracle: Founder comment 5972597691 distinguishes active non-terminal
  // COMMAND continuation from terminal Issue completion; execution-handoff-
  // contract.md requires return at terminal completion and fresh reconstruction
  // plus a newly appropriate handoff before starting a different Issue.
  it('ends the Execution session at terminal completion before another Issue', () => {
    expect(normalizedLoader).toMatch(/do not pre.authorize future objectives/i)
    expect(loader).toContain('- Execution handoff: load `docs/mission-control/execution-handoff-contract.md`')
    expect(normalizedExecutionHandoff).toMatch(/Under `COMMAND`, continue automatically with the next separately bounded objective in this Issue's same controller session/i)
    expect(normalizedExecutionHandoff).toMatch(/objective completion alone is not a Founder gate/i)
    expect(normalizedExecutionHandoff).toMatch(/terminal `COMPLETE` ends this Issue's active Execution session/i)
    expect(normalizedExecutionHandoff).toMatch(/a different Issue requires fresh Global MC reconstruction and a newly appropriate Execution handoff/i)
    expect(normalizedExecutionHandoff).toMatch(/after each durable objective and applicable HANDOFF\/readback: fresh GitHub.*merged policy.*applicable CLI Discovery.*fresh Context.*recompute route/i)
  })

  // Oracle: merged Mission Control guide v1.7, "Bounded objective execution",
  // keeps one Global MC across sequential campaign Issues while requiring
  // fresh Context after each durable result. #562 decision 6295209442 clarifies
  // that each Issue gets its own Execution lineage, but an Issue change alone
  // is not a Global MC control-plane boundary.
  it('reconstructs fresh per-Issue authority inside a still-valid Global MC session', () => {
    expect(normalizedExecutionHandoff).toMatch(/fresh live authority reconstruction within the same active Global MC session when it remains valid/i)
    expect(normalizedExecutionHandoff).toMatch(/a different Issue requires a newly appropriate Execution handoff/i)
    expect(normalizedExecutionHandoff).toMatch(/a new Global MC session is not required solely because the Issue changed/i)

    expect(normalizedLoader).toMatch(/fresh live authority reconstruction within the same active Global MC session when it remains valid/i)
    expect(normalizedLoader).toMatch(/a different Issue requires a new Execution handoff/i)
    expect(normalizedLoader).toMatch(/a new Global MC session is not required solely because the Issue changed/i)
    expect(normalizedLoader).not.toMatch(/Another Issue: fresh Global MC reconstruction/i)
  })

  // Oracle: Founder comment 5976454479 says generic handoff caution cannot
  // neutralize fresh Context's exact recovery; Founder direction #573 comment
  // 6008320328 additionally authorizes only the canonical pre-COMMAND
  // wrong-Issue acquisition path in section 12.
  it('routes exact fresh-Context recovery without adding a Founder relay', () => {
    expect(normalizedExecutionHandoff).toMatch(/only an exact deterministic recovery prescribed by that Context or canonical wrong-Issue workspace acquisition under section 12 may precede a later `COMMAND`.*within that recovery's scope/i)
    expect(normalizedExecutionHandoff).toMatch(/no controller or worker may mutate the authorized objective before fresh Context.*next_action.type: COMMAND.*a pre-COMMAND recovery is permitted only when fresh Context explicitly prescribes that exact bounded recovery under section 12, the canonical wrong-Issue workspace acquisition conditions under section 12 are met, or every condition of the Bridge B recovery/i)
    expect(normalizedExecutionHandoff).toMatch(/generic handoff caution cannot override an exact deterministic recovery prescribed by fresh Context/i)
    expect(normalizedExecutionHandoff).toMatch(/if Context prescribes switching to the correctly owned existing Issue branch and live repository evidence identifies exactly one candidate, perform only that switch/i)
    expect(normalizedExecutionHandoff).toMatch(/immediately rerun registered CLI Discovery and fresh Context without a Founder\/Global MC relay/i)
    expect(normalizedExecutionHandoff).toMatch(/switch grants no synchronization, rebase, reset, merge, implementation, edit, or future.objective authority/i)
  })

  // Oracle: Founder direction #573 comment 6008320328 requires reusable
  // workspace acquisition in this order: prefer one uniquely proven existing
  // Issue workspace; otherwise provision a separate canonical exact-live-base
  // checkout without changing the currently bound wrong-Issue checkout; stop
  // at ambiguity, unsafe state, or host capability boundaries. Acquisition
  // never grants implementation authority and is followed by Discovery and
  // fresh Context.
  it('prefers the exact Issue workspace, then permits only isolated canonical-base provisioning', () => {
    const continuationContract = normalizedExecutionHandoff
      .split('## 12. Continuation rule')[1]
      ?.split('## 13. Stop conditions')[0] ?? ''

    expect(continuationContract).toMatch(/reuse exact existing Issue workspace/i)
    expect(continuationContract).toMatch(/if exactly one clean, durable, canonical workspace\/branch owned by the queried Issue.*use the existing exact bounded recovery path/i)
    expect(continuationContract).toMatch(/if no usable queried-Issue workspace exists.*provision a separate isolated checkout.*exact live approved-base SHA/i)
    expect(continuationContract).toMatch(/must not mutate, reset, rebase, merge, stash, delete, force, or otherwise alter the currently bound wrong-Issue checkout/i)
    expect(continuationContract).toMatch(/verify canonical origin, exact live-base SHA, attached\/clean state, and absence\/conflict status of the queried-Issue topic branch/i)
    expect(continuationContract).toMatch(/if the queried-Issue branch does not yet exist.*normal zero-delta bootstrap eligibility.*canonical durable zero-delta branch bootstrap/i)
    expect(continuationContract).toMatch(/after either checkout path completes, immediately rerun registered CLI Discovery and fresh Context/i)
    expect(continuationContract).toMatch(/an unmerged active PR does not make an unrelated local Issue branch a valid workspace.*local branch and `HEAD` must match the active PR's exact head branch and SHA before any non-terminal active-PR route can apply.*Context remains `STOP`.*bind that recovery to the PR number, URL, base branch\/SHA, and head branch\/SHA/i)
    expect(continuationContract).toMatch(/registered CLI Discovery is still required.*fresh Context is still required.*source\/test\/doc edits still require an authorized Context route and the normal one-time first-edit trigger/i)
    expect(continuationContract).toMatch(/multiple plausible Issue workspaces\/branches.*dirty or non-durable state.*wrong\/noncanonical repository or origin.*conflicting\/stale live-base evidence.*conflicting existing target branch ownership.*filesystem\/network\/host capability prevents isolated safe provisioning/i)
    expect(continuationContract).toMatch(/if the agent can create and verify the isolated sibling checkout but the host cannot switch\/rebind its effective workspace\/root.*prepare the workspace completely first.*report the exact verified path as the single operator action.*do not ask the Founder to run Git clone\/fetch\/checkout commands manually/i)
    expect(continuationContract).toMatch(/no new general scheduler or worktree manager/i)
  })

  // Oracle: Issue #652 preserves the existing exact-sibling acquisition path
  // and adds only a bounded alternate location. Keep the sibling eligibility
  // independently visible so the alternate cannot silently replace it.
  it('preserves eligible existing Issue workspace acquisition alongside the alternate location', () => {
    const continuationContract = normalizedExecutionHandoff
      .split('## 12. Continuation rule')[1]
      ?.split('## 13. Stop conditions')[0] ?? ''

    const siblingPath = continuationContract.match(/reuse exact existing Issue workspace[\s\S]*?use the existing exact bounded recovery path/i)?.[0] ?? ''

    expect(siblingPath).not.toBe('')
    expect(siblingPath).toMatch(/exactly one clean, durable, canonical workspace\/branch owned by the queried Issue/i)
    expect(siblingPath).toMatch(/exact `origin\/\<branch\>` upstream/i)
  })

  // Oracle: Issue #652 uniquely specifies the alternate's safety boundary,
  // but not a serialized evidence shape. Assert only the required semantic
  // predicates: one absent checkout under one existing slot, independent
  // narrow capability proof, and no authority over the surrounding pool.
  it('constrains the alternate to one absent checkout in one Issue-exclusive slot with scoped capability proof', () => {
    const continuationContract = normalizedExecutionHandoff
      .split('## 12. Continuation rule')[1]
      ?.split('## 13. Stop conditions')[0] ?? ''

    expect(continuationContract).toMatch(/absent (?:new )?checkout path.*inside exactly one existing, initially empty, single-use, Issue-exclusive, host-provisioned slot/i)
    expect(continuationContract).toMatch(/independent(?:ly)? proof.*(?:runtime|host).*write\/create descendants.*required Git metadata.*within that slot/i)
    expect(continuationContract).toMatch(/pool parent.*unrelated checkouts.*other Issue slots.*outside (?:its|the slot's) write grant/i)
    expect(continuationContract).toMatch(/unique canonical slot\/path/i)
  })

  // Oracle: Issue #652 and §13 require fail-closed STOP for unsafe or
  // unproven slot acquisition. Do not choose a fallback route for any case
  // the authority excludes.
  it('keeps reused, occupied, ambiguous, ownership, path, and capability-proof gaps at STOP', () => {
    const continuationContract = normalizedExecutionHandoff
      .split('## 12. Continuation rule')[1]
      ?.split('## 13. Stop conditions')[0] ?? ''

    expect(continuationContract).toMatch(/\breused\b/i)
    expect(continuationContract).toMatch(/\boccupied\b/i)
    expect(continuationContract).toMatch(/\bambiguous\b/i)
    expect(continuationContract).toMatch(/conflicting ownership|wrong owner\/path/i)
    expect(continuationContract).toMatch(/missing effective permission|effective host capability.*cannot be verified/i)
    expect(continuationContract).toMatch(/`\/Users\/boat\/projects` remain outside the slot's write grant/i)
    expect(continuationContract).toMatch(/remain `STOP`|stays fail-closed/i)
  })

  // Oracle: Issue #605's preliminary objective and parked-source acceptance
  // criterion uniquely permit source release only after terminal completion
  // evidence or a durable non-COMMAND boundary with its required HANDOFF and
  // readback, with no active writer. They do not specify a Context route or a
  // serialized evidence schema, so this asserts only those eligibility facts.
  it('limits same-checkout Issue release to terminal or durably parked non-COMMAND sources', () => {
    const releaseContract = normalizedExecutionHandoff
      .split('2. **Release a completed or durably parked source checkout for sequential same-checkout setup.**')[1]
      ?.split('3. **Provision an isolated canonical workspace when none is usable.**')[0] ?? ''

    expect(releaseContract).not.toBe('')
    expect(releaseContract).toMatch(/verified terminal COMPLETE evidence or merged evidence/i)
    expect(releaseContract).toMatch(/verified parked non-COMMAND durable boundary with its required HANDOFF and readback/i)
    expect(releaseContract).toMatch(/release evidence.*same canonical source Issue.*same source branch.*exact current live source HEAD.*(?:no later source advancement|source has not advanced)/i)
    expect(releaseContract).toMatch(/no active source writer or controller/i)
    expect(releaseContract).toMatch(/(?:same checkout.*exact live approved base SHA|exact live approved base SHA.*same checkout)/i)
    expect(releaseContract).toMatch(/absent from local branches.*refs\/remotes\/origin.*live canonical remote/i)
    expect(releaseContract).toMatch(/effective write scope for the current checkout and its required Git metadata/i)
    expect(releaseContract).toMatch(/No Issue-A code, commits, or history are carried into the target/i)
    expect(releaseContract).toMatch(/unchanged source branch and remote head.*exact approved-base ref.*target local `HEAD`, canonical upstream, tracking ref, and live remote head/i)
    expect(releaseContract).toMatch(/adds no Context route.*state, evidence schema/i)
    expect(releaseContract).toMatch(/Preserve existing exact-target `SWITCH_BRANCH` recovery/i)
  })

  // Oracle: live #666 Acceptance Criteria require terminal Issue A to transfer
  // the same checkout to a valid existing Issue-B branch, preserve A's local
  // and remote refs, and require fresh Context afterward. Founder decision
  // 6340800913 establishes one canonical physical checkout with durable
  // per-Issue branches and forbids switching away from an unreleased source.
  // The merged §12 release and bootstrap contract supply the safety boundary:
  // source release must be terminal or a verified parked non-COMMAND HANDOFF
  // with readback and no writer; existing-target selection cannot invent a
  // Context route, and setup must be followed by fresh Context. This asserts
  // only that transfer contract, not a new route/evidence field or dirty-WIP
  // admission rule.
  it('transfers a released source to one valid existing Issue branch without changing source refs, then requires fresh Context', () => {
    const continuationContract = normalizedExecutionHandoff
      .split('## 12. Continuation rule')[1]
      ?.split('## 13. Stop conditions')[0] ?? ''

    expect(continuationContract).toMatch(/terminal (?:source )?Issue.{0,80}(?:existing|already.present) Issue.{0,50}branch/i)
    expect(continuationContract).toMatch(/(?:switch|select|reuse).{0,100}(?:exactly one|unique|verified).{0,80}(?:existing|already.present).{0,50}(?:target|Issue).{0,30}branch/i)
    expect(continuationContract).toMatch(/source (?:branch|refs?).{0,100}(?:unchanged|intact).{0,80}(?:remote|live)/i)
    expect(continuationContract).toMatch(/after (?:the )?(?:switch|transfer|checkout).{0,100}(?:registered CLI Discovery|fresh Context)/i)
  })

  // Oracle: live #666 acceptance criteria and Founder decision 6340800913
  // require the ordinary released Issue-A to Issue-B transfer in one physical
  // checkout. Section 12 explicitly provides that setup path. Section 8 must
  // not categorically restrict all pre-COMMAND workspace acquisition to clean,
  // isolated preparation, which would exclude the authorized same-checkout
  // branch transfer. This checks the policy contradiction, not a Context route.
  it('does not exclude the section 12 same-checkout transfer from pre-COMMAND acquisition', () => {
    const preCommandRule = normalizedExecutionHandoff
      .split('No controller or worker may mutate the authorized objective before fresh Context')[1]
      ?.split('## 9. Validation requirements')[0] ?? ''

    expect(preCommandRule).not.toBe('')
    expect(preCommandRule).not.toMatch(/workspace acquisition is limited to the clean, isolated preparation described there/i)
  })

  // Oracle: live #666 negative acceptance criteria and Founder decision
  // 6340800913 require each unsafe source to STOP before Git mutation. This
  // is contract-level coverage of §12's release predicate and STOP boundary,
  // not proof that a runtime transfer gate evaluates these cases.
  it.each([
    ['#588 OPEN and clean without verified release', /missing or ambiguous release evidence/i],
    ['uncommitted or unverified tracked work', /dirty or unresolved source work/i],
    ['unpushed source ref or missing live remote readback', /detached or local-only source/i],
    ['competing source writer or controller', /active source writer\/controller/i],
    ['live same-Issue COMMAND', /live same-Issue `COMMAND`/i],
    ['stale or moving approved base', /stale or moving base/i],
    ['duplicate or colliding target', /competing target or target collision/i],
    ['wrong canonical origin or source upstream', /wrong origin\/upstream/i],
    ['missing effective Host write scope', /missing independent host write-scope proof/i],
  ] as const)('requires STOP before Git mutation for %s', (_case, deniedCondition) => {
    const releaseContract = normalizedExecutionHandoff
      .split('2. **Release a completed or durably parked source checkout for sequential same-checkout setup.**')[1]
      ?.split('3. **Provision an isolated canonical workspace when none is usable.**')[0] ?? ''
    const sourceStop = releaseContract
      .match(/Any dirty or unresolved source work[\s\S]*?`STOP` before Git mutation\./i)?.[0] ?? ''

    expect(releaseContract).toMatch(/source Issue is independently proven releasable/i)
    expect(releaseContract).toMatch(/inventory every staged, unstaged, untracked, and ignored path/i)
    expect(releaseContract).toMatch(/authorized semantic or RED\/WIP checkpoint commit, nonforce push, and exact live remote SHA readback/i)
    expect(releaseContract).toMatch(/verified terminal COMPLETE evidence or merged evidence, or a verified parked non-COMMAND durable boundary with its required HANDOFF and readback/i)
    expect(sourceStop).toMatch(deniedCondition)
    expect(sourceStop).toMatch(/is `STOP` before Git mutation/i)
  })

  it('stops unresolved untracked, ignored, secret-bearing, or dependency-contaminated source state before Git mutation', () => {
    const releaseContract = normalizedExecutionHandoff
      .split('2. **Release a completed or durably parked source checkout for sequential same-checkout setup.**')[1]
      ?.split('3. **Provision an isolated canonical workspace when none is usable.**')[0] ?? ''

    expect(releaseContract).toMatch(/inventory every staged, unstaged, untracked, and ignored path.*prove no unresolved task-owned, unknown, conflicting, secret-bearing, or dependency-contaminated state remains/i)
    expect(releaseContract).toMatch(/unproven or drifting ignored artifacts are `STOP`/i)
    expect(releaseContract).toMatch(/any dirty or unresolved source work.*is `STOP` before Git mutation/i)
  })

  // Oracle: live #666 negative acceptance criteria require exact source and
  // target identity, current-head parked evidence, and collision-free target
  // refs before transfer. §12 uniquely says mismatch is STOP before mutation
  // or before fetch/checkout; this is contract-level coverage only.
  it('stops stale or mismatched parked HANDOFF binding and target refs before transfer', () => {
    const releaseContract = normalizedExecutionHandoff
      .split('2. **Release a completed or durably parked source checkout for sequential same-checkout setup.**')[1]
      ?.split('3. **Provision an isolated canonical workspace when none is usable.**')[0] ?? ''
    const sourceBinding = releaseContract
      .split('Terminal or parked release evidence must bind')[1]
      ?.split('Before mutation')[0] ?? ''
    const prefetch = releaseContract
      .split('Before any fetch')[1]
      ?.split('For a terminal source Issue transferring')[0] ?? ''

    expect(sourceBinding).toMatch(/same canonical source Issue and same source branch to the exact current live source HEAD, with no later source advancement/i)
    expect(sourceBinding).toMatch(/missing, stale, or mismatched binding is `STOP` before mutation/i)
    expect(prefetch).toMatch(/exact live canonical remote target head or prove its absence/i)
    expect(prefetch).toMatch(/every pre-existing local target ref and every pre-existing tracking ref must already equal that exact live head/i)
    expect(prefetch).toMatch(/stale or mismatched tracking ref.*`STOP` before fetch or checkout/i)
    expect(releaseContract).toMatch(/exactly one existing target Issue branch on the canonical remote, its Issue ownership/i)
    expect(releaseContract).toMatch(/ambiguous, or competing target refs are `STOP`/i)
  })

  // Oracle: live #666 acceptance requires exact head/upstream/readback for an
  // existing remote target and names stale/divergent refs, wrong ownership,
  // and permissions as mutation blockers. Founder direction permits reuse only
  // with independent freshness/durability proof; §12 remains fail-closed on
  // stale, ambiguous, or competing evidence. This excludes invalid reuse only;
  // it does not choose a fallback route.
  it('stops existing-target checkout when target ownership or durable refs are stale or ambiguous', () => {
    const continuationContract = normalizedExecutionHandoff
      .split('## 12. Continuation rule')[1]
      ?.split('## 13. Stop conditions')[0] ?? ''
    const existingTarget = continuationContract
      .split('For a terminal source Issue transferring to an existing Issue-B branch')[1]
      ?.split('If Issue B is absent from local branches')[0] ?? ''
    const prefetchTargetCheck = continuationContract
      .split('Before any fetch, independently read the exact live canonical remote')[1]
      ?.split('For a terminal source Issue transferring to an existing Issue-B branch')[0] ?? ''

    expect(existingTarget).not.toBe('')
    expect(prefetchTargetCheck).not.toBe('')
    expect(existingTarget).toMatch(/verify exactly one existing target Issue branch on the canonical remote, its Issue ownership, exact live head/i)
    expect(prefetchTargetCheck).toMatch(/every pre-existing local target ref and every pre-existing tracking ref must already equal that exact live head/i)
    expect(prefetchTargetCheck).toMatch(/any pre-existing local or tracking ref with no live target.*`STOP` before fetch or checkout/i)
    expect(prefetchTargetCheck).toMatch(/do not fetch to repair it, prune or delete refs/i)
    expect(existingTarget).toMatch(/local target must equal its tracking and live remote head/i)
    expect(existingTarget).toMatch(/Stale-base ancestry, divergent, unpushed, ambiguous, or competing target refs are `STOP`/i)
    expect(existingTarget).toMatch(/read back its tracking ref at the exact live remote head before checkout/i)
    // Existing remote-only targets are reusable only from already consistent
    // evidence. A stale tracking ref must not be silently refreshed by fetch;
    // a missing live target must not be recreated by pruning/deletion or fetch.
    expect(existingTarget).toMatch(/remote-only target may be reused when no stale local or tracking ref conflicts/i)
    expect(existingTarget).toMatch(/Do not pull, merge, or rebase another Issue into the source branch or target/i)
    expect(existingTarget).toMatch(/do not use an automatic fast-forward fallback/i)
  })

  // Oracle: merged §12 dependency-preparation/P1 rules require the exact live
  // approved-base SHA to be an ancestor of HEAD in the ordinary development
  // checkout before Context. Issue #666 only permits reuse of an existing
  // target with independent freshness/durability proof and explicitly rejects
  // stale/divergent refs. Therefore, an existing target failing this current
  // ancestry prerequisite cannot be checked out for Context; do not invent an
  // automatic pull/rebase or a fallback route.
  it('stops an existing Issue-B target that fails current approved-base ancestry before checkout and Context', () => {
    const continuationContract = normalizedExecutionHandoff
      .split('## 12. Continuation rule')[1]
      ?.split('## 13. Stop conditions')[0] ?? ''
    const existingTarget = continuationContract
      .split('For a terminal source Issue transferring to an existing Issue-B branch')[1]
      ?.split('If Issue B is absent from local branches')[0] ?? ''
    const preContextSetup = normalizedExecutionHandoff
      .split('### Pre-Context dependency preparation')[1]
      ?.split('**P1 — read-only reuse.**')[0] ?? ''

    expect(preContextSetup).toMatch(/exact live approved.base SHA must be an ancestor of `HEAD`/i)
    expect(existingTarget).toMatch(/exact live approved.base SHA is an ancestor of the existing target's exact live head/i)
    expect(existingTarget).toMatch(/target genuinely behind the live approved base, or one whose ancestry cannot be proven, is `STOP` before checkout or Context/i)
    expect(existingTarget).toMatch(/do not synchronize it as part of this transfer/i)
  })

  // Oracle: live Issue #666's “Founder policy-change decision — unblock
  // verified pre-Context WIP admission” authorizes a narrowly bound same-Issue
  // dirty-WIP exception solely for read-only CLI Discovery and fresh Context.
  // It requires exact repo/Issue/branch/HEAD/upstream/live-ref identity,
  // immutable per-path SHA-256/raw-diff evidence, complete tracked and ignored
  // inventory, provenance, sole-writer exclusion, supported cwd binding, and
  // effective Host Gitdir/ref access, rechecked before each read action. It
  // explicitly grants no WIP edit/stage/commit authority, and keeps valid
  // Context COMMAND plus the separate first-edit trigger as later gates. This
  // story asserts those boundaries and exclusions only; it creates no route or
  // evidence-field semantics and does not claim the decision changed current
  // merged policy. Read together with merged §12 P1, using installed tooling
  // also requires the full P1 proof against this exact checkout; every
  // dependency location approval remains separately bound, so another
  // checkout's P1 result cannot establish this one's tooling integrity.
  it('limits same-Issue dirty-WIP admission to verified read-only Discovery and Context', () => {
    const wipAdmission = normalizedExecutionHandoff
      .split('### Exact same-Issue dirty-WIP read-only re-entry')[1]
      ?.split('### Pre-Context dependency preparation')[0] ?? ''
    const readOnlyP1 = normalizedExecutionHandoff
      .split('**P1 — read-only reuse.**')[1]
      ?.split('**P2 — fresh preparation.**')[0] ?? ''

    expect(wipAdmission).not.toBe('')
    expect(readOnlyP1).not.toBe('')
    expect(normalizedExecutionHandoff).toMatch(/exact same-Issue WIP re-entry exception.*only to permit read-only CLI Discovery and fresh Context/i)
    expect(normalizedExecutionHandoff).toMatch(/canonical repo.*exact Issue\/topic branch\/HEAD\/upstream\/live remote/i)
    expect(normalizedExecutionHandoff).toMatch(/immutable.*per-path SHA-256.*raw diff ledger.*complete staged\/unstaged\/untracked\/ignored inventory/i)
    expect(normalizedExecutionHandoff).toMatch(/no unrelated work.*provenance and sole-writer exclusion.*supported working-directory binding.*effective Host Gitdir\/ref access/i)
    expect(normalizedExecutionHandoff).toMatch(/recheck immediately before each action.*fail closed on conflict or drift/i)
    expect(normalizedExecutionHandoff).toMatch(/WIP is held as read-only input until fresh native Context returns an independently valid `COMMAND`.*separately required first-edit trigger is satisfied/i)
    expect(normalizedExecutionHandoff).toMatch(/does not grant pre-Context source edits, stage\/commit\/push/i)
    expect(normalizedExecutionHandoff).toMatch(/Do not copy\/stash\/pop\/reset\/clean\/switch\/rebase\/force-push/i)
    expect(normalizedExecutionHandoff).toMatch(/no staging\/commit\/push/i)
    expect(normalizedExecutionHandoff).toMatch(/reject unrelated\/unknown dirty changes, competing writer, missing provenance, hash mismatch, changed tracked\/ignored scope, bad origin\/branch\/upstream\/ref, Host EPERM, and no native COMMAND before commit/i)

    // The exact dirty checkout does not weaken P1's prerequisite for reading
    // installed tooling, and P1 evidence remains bound to that checkout.
    expect(wipAdmission).toMatch(/before using installed dependencies or invoking any registered CLI, complete every P1 read-only reuse proof below for this same physical #666 checkout and its actual dependency roots/i)
    expect(wipAdmission).toMatch(/approved read-only realpaths, actual store, lock equivalence, artifact fingerprints, and non-mutating CLI module resolution/i)
    expect(wipAdmission).toMatch(/P1 evidence from the separate clean authoring checkout or another dependency root cannot be transferred or substituted/i)
    expect(readOnlyP1).toMatch(/read-only preflight positively proves every item below/i)
    expect(readOnlyP1).toMatch(/resolve required symlinks and realpaths only within explicitly approved read-only dependency locations/i)
    expect(readOnlyP1).toMatch(/record the resolved actual `storeDir`/i)
    expect(readOnlyP1).toMatch(/registered CLI entrypoint dependencies with non-mutating Node module resolution/i)

    // Oracle: merged §12 P1 plus Issue #666's source-cleanliness rule require
    // a complete ignored-path inventory, while preserving positively proven
    // dependency inputs. Unknown/contaminated ignored task state stops; the
    // policy does not require blanket absence of every ignored path or permit
    // sweeping approved dependency trees/stores.
    expect(normalizedExecutionHandoff).toMatch(/inventory every staged, unstaged, untracked, and ignored path/i)
    expect(normalizedExecutionHandoff).toMatch(/P1-approved ignored dependency trees and stores are retained as verified dependency inputs, not classified as task WIP or swept\/removed/i)
    expect(normalizedExecutionHandoff).toMatch(/unproven or drifting ignored artifacts are `STOP`/i)
  })

  // Oracle: Issue #605's live-COMMAND denial and negative acceptance criteria
  // exclude abandoning an active source or proceeding with dirty/unresolved,
  // stale, conflicting, colliding, concurrent, or unproven-host state. The
  // issue does not authorize a fallback route for any exclusion.
  it('keeps live COMMAND and unresolved source, target, concurrency, and host gaps fail-closed', () => {
    const releaseContract = normalizedExecutionHandoff
      .split('2. **Release a completed or durably parked source checkout for sequential same-checkout setup.**')[1]
      ?.split('3. **Provision an isolated canonical workspace when none is usable.**')[0] ?? ''

    expect(releaseContract).not.toBe('')
    expect(releaseContract).toMatch(/live same-Issue `COMMAND` must not be abandoned/i)
    expect(releaseContract).toMatch(/dirty or unresolved source work, detached or local-only source, wrong origin\/upstream, stale source HEAD/i)
    expect(releaseContract).toMatch(/active source writer\/controller, live same-Issue `COMMAND`, stale or moving base, competing target or target collision, or missing independent host write-scope proof is `STOP` before Git mutation/i)
  })

  // Oracle: #632 Objective A's acceptance criteria and the user's request for
  // one minimal policy amendment specify the eligible development checkout,
  // exact frozen install, bounded effects, and negative exclusions. The test
  // protects the requested post-merge contract; it grants no present authority.
  // Setup is followed only by Discovery + fresh Context, without a Context route.
  it('limits pre-Context dependency preparation to verified development checkouts and setup-only continuation', () => {
    const dependencyPreparation = normalizedExecutionHandoff
      .split('### Pre-Context dependency preparation')[1]
      ?.split('### Bridge B: stale target predates recovery emission')[0] ?? ''

    expect(dependencyPreparation).not.toBe('')
    expect(dependencyPreparation).toMatch(/development Issue checkout/i)
    expect(dependencyPreparation).toMatch(/queried Issue and its handoff must uniquely establish one Issue-owned topic branch/i)
    expect(dependencyPreparation).toMatch(/canonical origin/i)
    expect(dependencyPreparation).toMatch(/exact live approved.base SHA/i)
    expect(dependencyPreparation).toMatch(/clean, attached, durable Issue branch.*upstream/i)
    expect(dependencyPreparation).toMatch(/exact live remote topic ref must both equal `HEAD`/i)
    expect(dependencyPreparation).toMatch(/Node version.*engines\.node.*checked-in CI Node version/i)
    expect(dependencyPreparation).toMatch(/pnpm version configured by checked-in CI.*engines\.pnpm.*pnpm-lock\.yaml.*lockfile version/i)
    expect(dependencyPreparation).toMatch(/package\.json` has no `packageManager` field/i)
    expect(dependencyPreparation).toMatch(/package\.json.*pnpm-lock\.yaml/i)
    expect(dependencyPreparation).toMatch(/pnpm install --frozen-lockfile --ignore-scripts --store-dir <task-local-store>/i)
    expect(dependencyPreparation).toMatch(/no lifecycle scripts|lifecycle scripts.*(?:must not run|disabled|not execute)/i)
    expect(dependencyPreparation).toMatch(/writes must be bounded to this checkout's `node_modules` and that task.local package store/i)
    expect(dependencyPreparation).toMatch(/unchanged.*(?:package\.json.*pnpm-lock\.yaml|manifest.*lockfile).*identit/i)
    expect(dependencyPreparation).toMatch(/tracked.*clean|clean.*tracked/i)
    expect(dependencyPreparation).toMatch(/HEAD.*unchanged|unchanged.*HEAD/i)
    expect(dependencyPreparation).toMatch(/dirty|wrong.*origin|origin.*wrong|drift|mismatch|unsupported/i)
    expect(dependencyPreparation).toMatch(/STOP/i)
    expect(dependencyPreparation).toMatch(/Source D.*no.install|no.install.*Source D/i)
    expect(dependencyPreparation).toMatch(/registered CLI Discovery.*fresh Context/i)
    expect(dependencyPreparation).toMatch(/no .*COMMAND.*first.edit.*authority|grants no .*objective.*authority/i)

    expect(normalizedContextStoryMatrix).toMatch(/Pre.Context dependency preparation is setup.only.*Issue #632 Objective A criteria/i)
    expect(normalizedContextStoryMatrix).toMatch(/development Issue checkout.*frozen.lockfile.*ignore.scripts/i)
    expect(normalizedContextStoryMatrix).toMatch(/Source D.*no.install|no.install.*Source D/i)
  })

  // Oracle: #632 Objective A requires setup-only eligibility for an Issue
  // checkout; the user's post-merge direction returns to the existing #632
  // controller under freshly verified authority. Assert the generic bounded
  // historical-base state and that setup grants no sync or Context route.
  it('limits post-merge stale-base setup to the exact zero-delta historical-base tip', () => {
    const dependencyPreparation = normalizedExecutionHandoff
      .split('### Pre-Context dependency preparation')[1]
      ?.split('### Bridge B: stale target predates recovery emission')[0] ?? ''
    const postMergeStart = dependencyPreparation.toLowerCase().indexOf('post-merge')
    const postMergeCase = postMergeStart < 0 ? '' : dependencyPreparation.slice(postMergeStart)

    expect(postMergeCase).not.toBe('')
    expect(postMergeCase).toMatch(/`?HEAD`? exactly equals the recorded historical approved-base SHA/i)
    expect(postMergeCase).toMatch(/this branch to be clean, attached, and durable/i)
    expect(postMergeCase).toMatch(/exact live remote topic ref equal `HEAD`/i)
    expect(postMergeCase).toMatch(/recorded historical approved-base SHA.*ancestor of the current live approved-base SHA/i)
    expect(dependencyPreparation).toMatch(/all other stale or conflicting states? (?:remain|are) `STOP`/i)
    expect(postMergeCase).toMatch(/only `pnpm install --frozen-lockfile --ignore-scripts --store-dir <task-local-store>`.*registered CLI Discovery.*fresh Context/i)
    expect(postMergeCase).toMatch(/does not authorize (?:a )?branch synchronization/i)
    expect(postMergeCase).toMatch(/does not select or grant a Context route/i)

    expect(normalizedContextStoryMatrix).toMatch(/#632 Objective A.*post.merge.*historical approved.base SHA.*ancestor of the current live approved.base SHA/i)
  })

  // Oracle: #632 Objective A requests merged authority for this pre-Context
  // operation only as bounded setup, never as an objective route. Section 8
  // and the STOP rule enumerate permitted pre-COMMAND work, so the exception
  // must be explicit there after the amendment merges.
  it('includes dependency preparation in the setup-only pre-COMMAND exception list', () => {
    const sectionTwelveStopParagraph = normalizedExecutionHandoff
      .split('For `STOP`, unsupported state')[1]
      ?.split('### Exact bounded recovery')[0] ?? ''
    const preCommandExceptions = normalizedExecutionHandoff
      .split('A pre-COMMAND recovery is permitted only when')[1]
      ?.split('Canonical pre-COMMAND workspace acquisition')[0] ?? ''
    const stopConditions = normalizedExecutionHandoff
      .split('## 13. Stop conditions')[1]
      ?.split('## 14. Founder decision status')[0] ?? ''

    expect(sectionTwelveStopParagraph).toMatch(/only pre.COMMAND exceptions.*exact existing.branch recovery.*canonical wrong.Issue workspace acquisition.*single pre.Context dependency preparation.*setup.only.*before CLI Discovery/i)
    expect(sectionTwelveStopParagraph).toMatch(/grants no objective.work authority/i)
    expect(preCommandExceptions).toMatch(/pre.Context dependency preparation.*section 12/i)
    expect(preCommandExceptions).toMatch(/setup.only.*no objective.work authority/i)
    expect(stopConditions).toMatch(/pre.Context dependency preparation.*section 12/i)
  })

  // Oracle: AGENTS.md and the issue-driven branch workflow currently require
  // registered safe help before Context. #632 Objective A inserts only its
  // eligible development-checkout setup before help; Source D remains excluded
  // under #630's explicit no-install contract.
  it('puts eligible development-checkout dependency preparation before Discovery in issue startup instructions', () => {
    const startupInstructions = [
      [
        'AGENTS.md',
        normalizedAgentInstructions
          .split('## Required First Steps Before File Edits')[1]
          ?.split('## Default Agent Workflow')[0] ?? '',
      ],
      [
        'docs/agent-loop/issue-driven-branch-workflow.md',
        normalizedIssueBranchWorkflow
          .split('## Required first steps (before any file edit)')[1]
          ?.split('## Durable zero-delta branch bootstrap')[0] ?? '',
      ],
    ] as const

    for (const [path, instructions] of startupInstructions) {
      const setupPosition = instructions.indexOf('Pre-Context dependency preparation')
      const discoveryPosition = instructions.indexOf('pnpm run bemoat:context -- --help --json')
      const contextPosition = instructions.indexOf('pnpm run bemoat:context <issue-number>')

      expect(setupPosition, `${path}: pre-Context setup instructions`).toBeGreaterThanOrEqual(0)
      expect(setupPosition, `${path}: setup precedes safe help`).toBeLessThan(discoveryPosition)
      expect(discoveryPosition, `${path}: safe help precedes fresh Context`).toBeLessThan(contextPosition)
      expect(instructions).toMatch(/verified.*development Issue checkout/i)
      expect(instructions).toMatch(/canonical origin.*approved.base SHA|approved.base SHA.*canonical origin/i)
      expect(instructions).toMatch(/Source D.*no.install|no.install.*Source D/i)
    }
  })

  // Oracle: Founder decision #565 comment 5991707507 and the Context Story
  // Matrix's stale-branch bootstrap story authorize only the existing registered
  // sync-base command from exact protected main into one explicit stale target.
  // Ordinary stale Context remains STOP; every other ambiguity stays STOP.
  it('recognizes the registered protected-main sync command as the exact stale-branch recovery', () => {
    const bridgeBContract = normalizedExecutionHandoff
      .split('### Bridge B: stale target predates recovery emission')[1]
      ?.split('## 13. Stop conditions')[0] ?? ''

    expect(normalizedExecutionHandoff).toMatch(/stale target branch predates the recovery.emitting Context implementation/i)
    expect(normalizedExecutionHandoff).toMatch(/ordinary stale Context remains `STOP`/i)
    expect(normalizedExecutionHandoff).toMatch(/route is `STOP` solely because.*recorded base differs from the live protected.main SHA.*no additional Context conflicts/i)
    expect(normalizedExecutionHandoff).toMatch(/does not add a Context mode or let Execution infer a fallback from prose/i)
    expect(bridgeBContract).toMatch(/`bemoat:context:sync-base`.*command contract and its safe help invocation/i)
    expect(bridgeBContract).toMatch(/unique clean checkout of the canonical protected.main branch at the exact live protected.main SHA, with exactly one explicit `--target-worktree`/i)
    expect(bridgeBContract).toMatch(/bemoat:context:sync-base -- <issue.number> --target-worktree <absolute.path> --json/i)
    expect(bridgeBContract).toMatch(/canonical origin.*upstream|upstream.*canonical origin/i)
    expect(bridgeBContract).toMatch(/source and target identity, same Issue\/PR\/base\/head, canonical origin\/upstream, clean attached and pushed target durability, old.base ancestry, stale.base.only eligibility, merge.tree conflict preflight, head.drift, exact post.write head, push, and remote.readback/i)
    expect(bridgeBContract).toMatch(/metadata changes, PR merge, or bypassing any branch.protection, CI, review, or no.autonomous.merge gate/i)
    expect(bridgeBContract).toMatch(/fresh `bemoat:context` in the target.*fresh exact.head CI and independent semantic\/Delta review/i)
    expect(normalizedExecutionHandoff).toMatch(/every other `STOP`.*remains `STOP`/i)
    expect(normalizedExecutionHandoff).toMatch(/missing, multiple, ambiguous, or conflicting.*remain `STOP`/i)
  })

  // Oracle: Founder comment 5976454479 explicitly requires fail-closed STOP
  // for missing, multiple, ambiguous, or conflicting branch candidates;
  // Founder direction #573 comment 6008320328 permits isolated setup only
  // under the exact canonical acquisition conditions in section 12.
  it('keeps missing or ambiguous Issue-owned branch candidates at STOP', () => {
    expect(normalizedExecutionHandoff).toMatch(/missing, multiple, ambiguous, or conflicting candidates remain `STOP`; do not guess/i)
    expect(normalizedLoader).toMatch(/`STOP`.*stop fail-closed for task\/source\/workflow mutation/i)
    expect(normalizedExecutionHandoff).toMatch(/at `STOP`, no objective mutation or delegation is allowed except the exact bounded recovery fresh Context prescribes under section 12, canonical wrong-Issue workspace acquisition under section 12, or the fully qualified Bridge B recovery in section 12/i)
    expect(normalizedExecutionHandoff).toMatch(/at `FOUNDER_GATE`, include no mutation.capable instructions or delegated mutation/i)
  })

  // Oracle: the protected-base AGENTS.md loader and canonical router semantics
  // require the full execution contract for every authorized objective or
  // recovery, including non-PStack work, so its §12/§13 gates remain available.
  it('routes each phase trigger to a real canonical contract and loads it only when triggered', () => {
    const routes = [
      ['Execution handoff', 'docs/mission-control/execution-handoff-contract.md'],
      ['Authorized objective/recovery', 'docs/mission-control/execution-handoff-contract.md'],
      ['model recommendations', 'docs/mission-control/model-routing-profile.md'],
      ['REVIEW_VERDICT', 'docs/mission-control/review-verdict-template.md'],
      ['BLOCKER_RESOLUTION', 'docs/mission-control/blocker-resolution-template.md'],
      ['Issue intake', 'docs/agent-loop/issue-intake-contract.md'],
      ['HANDOFF', 'docs/mission-control/handoff-template.md'],
      ['Context and command semantics', 'docs/mission-control/command-reference.md'],
    ] as const

    for (const [trigger, contract] of routes) {
      expect(loader).toContain(trigger)
      expect(loader).toContain(contract)
      expect(existsSync(resolve(root, contract)), `${trigger} contract exists: ${contract}`).toBe(true)
      expect(normalizedLoader).toMatch(new RegExp(`when .*${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*load`, 'i'))
    }
  })

  it('does not keep campaign instructions or the full execution artifact always loaded', () => {
    expect(loader).not.toMatch(/#512|#532/)
    expect(loader).not.toMatch(/^## \d+\. (Repository \/ Issue \/ PR identity|Current bounded objective|Verified live authority \/ route)/m)
    expect(loader).not.toMatch(/```ready-to-paste/)
  })

  it('does not load unrelated phase contracts just because they are available', () => {
    expect(normalizedLoader).toMatch(/load a phase contract only when triggered/i)
    expect(normalizedLoader).toMatch(/contract's existence alone does not trigger loading/i)
  })

  it('includes new canonical contracts and router regressions in child-sync inventory', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, '.bemoat/boilerplate-sync-manifest.json'), 'utf8')) as {
      managedPaths: string[]
    }
    const inventory = readFileSync(resolve(root, 'scripts/boilerplate/inventory.ts'), 'utf8')

    for (const path of [
      'docs/mission-control/execution-handoff-contract.md',
      'docs/mission-control/model-routing-profile.md',
      'tests/int/mission-control-loader-router.int.spec.ts',
    ]) {
      expect(manifest.managedPaths).toContain(path)
      expect(inventory).toContain(path)
    }
  })
})
