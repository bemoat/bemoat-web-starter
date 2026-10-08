import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const loaderPath = 'prompts/mission-control/chatgpt-project-loader.md'
const loader = readFileSync(resolve(root, loaderPath), 'utf8')
const normalizedLoader = loader.replace(/\s+/g, ' ')
const executionHandoff = readFileSync(resolve(root, 'docs/mission-control/execution-handoff-contract.md'), 'utf8')
const commandReference = readFileSync(resolve(root, 'docs/mission-control/command-reference.md'), 'utf8')
const normalizedExecutionHandoff = executionHandoff.replace(/\s+/g, ' ')
const normalizedCommandReference = commandReference.replace(/\s+/g, ' ')
const sameIssueAcquisitionContract = normalizedExecutionHandoff
  .split('#### Same-Issue acquisition after local-durability STOP')[1]
  ?.split('#### Wrong-Issue acquisition')[0] ?? ''
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
    expect(normalizedLoader).toMatch(/after that trigger has been satisfied, `COMMAND` means continue automatically in the same Execution controller session/i)
    expect(normalizedLoader).toMatch(/do not end the turn.*status.only response/i)
    expect(normalizedLoader).toMatch(/return to Founder\/Global MC to relay the route.*ask for confirmation/i)
  })

  it('preserves the first-edit trigger without asking again after later COMMAND results', () => {
    expect(normalizedLoader).toMatch(/one-time post-preflight implementation trigger.*before the first source-file edit/i)
    expect(normalizedLoader).toMatch(/fresh `COMMAND` does not satisfy or waive that trigger/i)
    expect(normalizedLoader).toMatch(/after that trigger has been satisfied, `COMMAND` means continue.*automatically/i)
    expect(normalizedLoader).toMatch(/do not.*ask for confirmation again/i)
    expect(normalizedLoader).toMatch(/`FOUNDER_GATE`.*return to Founder once.*required decision/i)
    expect(normalizedLoader).toMatch(/`STOP`.*stop fail-closed/i)
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
    expect(normalizedLoader).toMatch(/after a human gate or implementation trigger.*Next action.*operator-executable/i)
    expect(normalizedLoader).toMatch(/existing Execution\/IDE session.*send `continue`.*already-authorized/i)
    expect(normalizedLoader).toMatch(/only when cross-session operator action is actually needed/i)
    expect(normalizedLoader).toMatch(/do not use authorization-only wording.*proceed.*begin implementation.*continue.*without saying where and how/i)
  })

  it('requires no Founder action when the active controller must continue automatically', () => {
    expect(normalizedLoader).toMatch(/active Execution controller.*`COMMAND`.*Next action.*no additional Founder\/operator action is required.*continue automatically/i)
  })

  it('keeps STOP recovery narrower than task or workflow mutation', () => {
    expect(normalizedLoader).toMatch(/`STOP`.*stop fail-closed for task\/source\/workflow mutation/i)
    expect(normalizedLoader).toMatch(/exact-recovery and session rules in `docs\/mission.control\/execution.handoff.contract\.md`/i)
    expect(normalizedExecutionHandoff).toMatch(/switch grants no synchronization.*implementation.*future.objective authority/i)
    expect(normalizedLoader).toMatch(/absent.*conflicting.*unsupported recovery.*stop/i)
    expect(normalizedLoader).toMatch(/`FOUNDER_GATE` means no mutation and return to Founder once for the required decision/i)
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
    expect(normalizedLoader).toMatch(/after that trigger has been satisfied.*`COMMAND` means continue automatically in the same Execution controller session only while this Issue is nonterminal and fresh Context authorizes it/i)
    expect(normalizedLoader).toMatch(/do not pre.authorize future objectives/i)
    expect(normalizedExecutionHandoff).toMatch(/On terminal completion, return/i)
    expect(normalizedExecutionHandoff).toMatch(/terminal `COMPLETE` ends this Issue's active Execution session/i)
    expect(normalizedExecutionHandoff).toMatch(/a different Issue requires fresh Global MC reconstruction and a newly appropriate Execution handoff/i)
    expect(normalizedLoader).toMatch(/one.time post.preflight implementation trigger.*before the first source.file edit/i)
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

  // Oracle: Issue #618's accepted objective permits acquisition only for the
  // same queried Issue when the source is STOP / LOCAL_STATE_NOT_DURABLE, and
  // only after exact canonical repository, Issue branch/head, origin, and
  // approved-base proof. Merged execution-handoff-contract.md §12 establishes
  // acquisition as isolated setup followed by Discovery and fresh Context,
  // never objective authority. The candidate implementation is not authority.
  it('allows only exact same-Issue clean acquisition from a local durability STOP', () => {
    expect(sameIssueAcquisitionContract).toMatch(/same-Issue.*`STOP`.*`LOCAL_STATE_NOT_DURABLE`/i)
    expect(sameIssueAcquisitionContract).toMatch(/exact canonical repository and queried Issue identity/i)
    expect(sameIssueAcquisitionContract).toMatch(/source Issue branch, canonical `origin`, and `origin\/<branch>` upstream/i)
    expect(sameIssueAcquisitionContract).toMatch(/approved protected-base branch and exact live approved-base SHA/i)
    expect(sameIssueAcquisitionContract).toMatch(/one unique Issue remote branch with its exact live head SHA/i)
    expect(sameIssueAcquisitionContract).toMatch(/separate isolated.*clean.*destination/i)
    expect(sameIssueAcquisitionContract).toMatch(/acquisition only.*does not authorize.*objective work/i)
    // The wrong-Issue clean-source precondition remains separately asserted by
    // the existing wrong-Issue acquisition story below.
  })

  // Oracle: Issue #618 requires preserving dirty source/backups and forbids
  // candidate-source copying before the acquired destination independently
  // authorizes work. Section 12's existing setup-only and re-Context rules
  // establish the boundary; no candidate implementation behavior is assumed.
  it('preserves the stopped source and candidate while the destination is prepared', () => {
    expect(sameIssueAcquisitionContract).toMatch(/preserve the dirty source workspace and every associated backup unchanged/i)
    expect(sameIssueAcquisitionContract).toMatch(/any source or backup mutation must remain `STOP`/i)
    expect(sameIssueAcquisitionContract).toMatch(/do not copy.*candidate source files.*before.*registered CLI Discovery.*fresh Context/i)
    expect(sameIssueAcquisitionContract).toMatch(/acquire only one separate isolated, clean destination/i)
  })

  // Oracle: Issue #618 and merged section 12 require registered CLI Discovery
  // and fresh Context in the acquired workspace before objective edits. The
  // repository's one-time first-edit rule requires both Context COMMAND and
  // the first-edit trigger; this is setup authority, not STOP bypass.
  it('requires destination Discovery, fresh COMMAND, and the first-edit trigger before objective edits', () => {
    expect(sameIssueAcquisitionContract).toMatch(/in the acquired workspace.*registered CLI Discovery.*fresh Context/i)
    expect(sameIssueAcquisitionContract).toMatch(/Context.*`next_action.type: COMMAND`.*first-edit trigger.*before.*objective edits/i)
    expect(sameIssueAcquisitionContract).toMatch(/if fresh Context.*does not return.*COMMAND.*stop/i)
    expect(sameIssueAcquisitionContract).toMatch(/workspace acquisition.*never.*objective work/i)
  })

  // Oracle: Issue #618 explicitly requires fail-closed identity and evidence
  // checks. Section 12 already makes multiple candidates, stale/conflicting
  // refs, noncanonical origin, and mutation/loss of unrelated work STOP
  // conditions. This story binds those exclusions to same-Issue acquisition.
  it('fails closed on wrong identity, ambiguity, stale refs, and source or backup mutation', () => {
    expect(sameIssueAcquisitionContract).toMatch(/wrong Issue.*branch.*origin.*remain `STOP`/i)
    // Issue #618 acceptance criterion 2 explicitly names ambiguous multiple
    // workspaces as a STOP case; branch-only ambiguity is not a substitute.
    expect(sameIssueAcquisitionContract).toMatch(/ambiguous.*workspace.*remain `STOP`/i)
    expect(sameIssueAcquisitionContract).toMatch(/stale.*divergent.*remote.*remain `STOP`/i)
    expect(sameIssueAcquisitionContract).toMatch(/source or backup.*mutation.*remain `STOP`/i)
    expect(sameIssueAcquisitionContract).toMatch(/no objective mutation.*at `STOP`/i)
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
    expect(normalizedLoader).toMatch(/absent, conflicting, or unsupported recovery.*stop/i)
    expect(normalizedExecutionHandoff).toMatch(/at `STOP`, no objective mutation or delegation is allowed except the exact bounded recovery fresh Context prescribes under section 12, canonical wrong-Issue workspace acquisition under section 12, or the fully qualified Bridge B recovery in section 12/i)
    expect(normalizedExecutionHandoff).toMatch(/at `FOUNDER_GATE`, include no mutation.capable instructions or delegated mutation/i)
  })

  it('routes each phase trigger to a real canonical contract and loads it only when triggered', () => {
    const routes = [
      ['Execution handoff', 'docs/mission-control/execution-handoff-contract.md'],
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
