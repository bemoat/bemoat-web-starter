import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\s+/g, ' ')

describe('Mission Control delegation and execution model policy', () => {
  function readyToPasteArtifactContract() {
    const loader = readFileSync(resolve(root, 'docs/mission-control/execution-handoff-contract.md'), 'utf8')
    const heading = loader.indexOf('## Ready-to-paste execution artifact contract')
    if (heading < 0) return ''
    const fence = loader.indexOf('```ready-to-paste\n', heading)
    if (fence < 0) return ''
    const contentStart = fence + '```ready-to-paste\n'.length
    const contentEnd = loader.indexOf('```', contentStart)
    return contentEnd < 0 ? '' : loader.slice(contentStart, contentEnd)
  }

  function artifactSection(title: string) {
    const headings = [...readyToPasteArtifactContract().matchAll(/^## \d+\. (.+)$/gm)]
    const found = headings.find((heading) => heading[1] === title)
    if (!found || found.index === undefined) return ''
    const nextHeading = headings.find((heading) => (heading.index ?? -1) > found.index!)
    return readyToPasteArtifactContract()
      .slice(found.index + found[0].length, nextHeading?.index)
      .replace(/\s+/g, ' ')
  }

  describe('Global MC to Execution/IDE preflight contract', () => {
    it('permits a preflight handoff when Context is unavailable only because Global MC lacks local CLI', () => {
      expect(artifactSection('Verified live authority / route')).toMatch(/Global MC cannot execute repository-local CLI.*route remains unresolved until Execution\/IDE MC runs fresh Context/i)
      expect(artifactSection('Verified live authority / route')).toMatch(/this reason alone is not a `CONTRACT VIOLATION`.*required live .*evidence is verified/i)
      expect(read('prompts/mission-control/chatgpt-project-loader.md')).toMatch(/Global MC delegates CLI Discovery to Execution\/IDE MC/i)
      const loader = read('prompts/mission-control/chatgpt-project-loader.md').replace(/\s+/g, ' ')
      expect(loader).toMatch(/Global MC verifies live GitHub.*merged loader.*merged policy/i)
      expect(loader).toMatch(/Global MC does not run repository-local Bemoat CLI and does not guess Context routes/i)
      expect(loader).toMatch(/Execution\/IDE MC performs registered CLI Discovery and runs fresh.*bemoat:context.*before mutation/i)
      expect(loader).toMatch(/one-time post-preflight implementation trigger.*before the first source-file edit.*fresh `COMMAND` does not satisfy or waive that trigger/i)
      expect(loader).toMatch(/after that trigger has been satisfied, `COMMAND` means continue automatically in the same Execution controller session.*`FOUNDER_GATE` means no mutation and return to Founder.*`STOP`, unsupported state, or evidence conflict means stop fail-closed for task\/source\/workflow mutation/i)
      expect(loader).not.toMatch(/Run pnpm run bemoat:context <issue-number> --json when the current environment can execute repository-local CLI/i)
    })

    it('requires Execution/IDE MC to resolve fresh Context before any mutation and forbids guessing', () => {
      expect(artifactSection('Verified live authority / route')).toMatch(/Execution\/IDE MC must run fresh Context and inspect `next_action.type` before mutation/i)
      expect(artifactSection('Startup / reconstruction instructions')).toMatch(/registered CLI Discovery.*fresh.*bemoat:context <issue-number> --json.*inspect.*route.*before mutation/i)
      expect(artifactSection('Execution / delegation rules')).toMatch(/No controller or worker may.*before fresh Context.*COMMAND/i)
      expect(artifactSection('Verified live authority / route')).toMatch(/do not guess.*route/i)
    })

    it('continues in the same session only when next_action.type is COMMAND', () => {
      const continuation = artifactSection('Continuation rule')
      expect(continuation).toMatch(/after that trigger has been satisfied.*fresh Context returns `next_action.type` as `COMMAND`.*continue automatically.*same controller session/i)
      expect(continuation).toMatch(/do not return to Global MC.*solely.*Context.*COMMAND/i)
      expect(continuation).toMatch(/next separately bounded objective/i)
      expect(continuation).toMatch(/do not pre-authorize future objectives/i)
    })

    it('does not end the active controller turn after a fresh COMMAND result', () => {
      const continuation = artifactSection('Continuation rule')
      expect(continuation).toMatch(/COMMAND.*do not end.*active controller turn/i)
      expect(continuation).toMatch(/status-only response.*Founder/i)
      expect(continuation).toMatch(/start.*next separately bounded objective.*immediately/i)
      expect(continuation).toMatch(/two successive fresh Context results.*COMMAND.*start each newly authorized objective.*same session/i)
      expect(continuation).toMatch(/objective completion.*alone.*not.*Founder gate/i)
    })

    it('keeps the first-edit trigger while continuing later COMMAND results automatically', () => {
      const continuation = artifactSection('Continuation rule')
      expect(continuation).toMatch(/one-time post-preflight implementation trigger.*before the first source-file edit/i)
      expect(continuation).toMatch(/fresh `COMMAND` does not satisfy or waive that trigger/i)
      expect(continuation).toMatch(/after that trigger has been satisfied.*fresh Context.*`COMMAND`.*continue automatically/i)
      expect(continuation).toMatch(/do not.*ask for confirmation again/i)
      expect(continuation).toMatch(/FOUNDER_GATE.*required decision/i)
      expect(continuation).toMatch(/STOP.*unsupported state.*evidence conflict.*stop fail-closed/i)
    })

    it('returns FOUNDER_GATE without mutation and identifies the required decision', () => {
      expect(artifactSection('Continuation rule')).toMatch(/FOUNDER_GATE.*do not mutate.*return to Founder.*required decision/i)
      expect(artifactSection('Founder decision status')).toMatch(/FOUNDER_GATE.*human decision from the Founder.*no worker/i)
      expect(artifactSection('Stop conditions')).toMatch(/FOUNDER_GATE.*no mutation/i)
    })

    it('stops fail-closed without mutation for STOP and unsupported evidence', () => {
      expect(artifactSection('Continuation rule')).toMatch(/STOP.*unsupported state.*evidence conflict.*do not mutate the authorized objective.*stop fail.closed/i)
      expect(artifactSection('Stop conditions')).toMatch(/At `STOP`, no objective mutation or delegation.*except the exact bounded recovery fresh Context prescribes.*missing.*unsupported recovery stays fail.closed/i)
      expect(artifactSection('Stop conditions')).toMatch(/At `FOUNDER_GATE`, include no mutation.capable instructions or delegated mutation/i)
    })

    it('treats missing authority, guessed routes, omitted pre-mutation Context, and early mutation as violations', () => {
      const authority = artifactSection('Verified live authority / route')
      expect(authority).toMatch(/lacks required live authority.*CONTRACT VIOLATION/i)
      expect(authority).toMatch(/guesses or omits this pre-mutation Context step.*CONTRACT VIOLATION/i)
      expect(authority).toMatch(/permits objective mutation before Context returns `COMMAND`.*CONTRACT VIOLATION/i)
    })

    it('reconstructs fresh evidence when it changes before mutation', () => {
      expect(artifactSection('Startup / reconstruction instructions')).toMatch(/evidence changes.*reconstruct again/i)
      expect(artifactSection('Execution / delegation rules')).toMatch(/No controller or worker may.*before fresh Context.*COMMAND/i)
    })
  })

  it('requires the canonical 15 ordered sections inside the Ready-to-paste artifact', () => {
    const artifact = readyToPasteArtifactContract()
    const headings = [...artifact.matchAll(/^## \d+\. (.+)$/gm)].map((match) => match[1])
    expect(headings).toEqual([
      'Repository / Issue / PR identity',
      'Current bounded objective',
      'Verified live authority / route',
      'Startup / reconstruction instructions',
      'Permitted scope',
      'Prohibited scope',
      'Model routing',
      'Execution / delegation rules',
      'Validation requirements',
      'Durable result / HANDOFF / readback',
      'Fresh Context requirement',
      'Continuation rule',
      'Stop conditions',
      'Founder decision status',
      'Required return contract',
    ])
    expect(artifact).toMatch(/inside this Ready-to-paste artifact/i)
    expect(artifact.replace(/\s+/g, ' ')).toMatch(/withhold.*missing or contradictory.*unresolved except for the fresh Context route/i)
    expect(artifact.replace(/\s+/g, ' ')).toMatch(/unresolved except for the fresh Context route when it is unavailable solely because Global MC cannot run repository-local CLI and required live authority is verified/i)
    expect(artifact).toMatch(/do not return to Founder for this deterministic correction/i)
  })

  describe('Execution handoffs by destination session', () => {
    const contract = read('docs/mission-control/execution-handoff-contract.md')
    const loader = read('prompts/mission-control/chatgpt-project-loader.md')
    const continuation = artifactSection('Continuation rule')

    // Authority: execution-handoff-contract.md requires every Ready-to-paste
    // Execution/IDE prompt to contain all 15 sections inside the artifact.
    // Issue #512 comment 5998215788 records that a new session cannot use a
    // bootstrap-only message or `continue` as a substitute.
    it('requires a complete artifact when the destination is a new Execution/IDE session', () => {
      expect(continuation).toMatch(/new Execution\/IDE session.*MUST emit.*complete canonical.*all 15 ordered sections inside the artifact/i)
      expect(continuation).toMatch(/MUST NOT substitute.*bootstrap.*`continue`.*summary.*surrounding prose/i)
    })

    // Authority: the existing-session exception applies only to the same
    // Issue's still-valid active Execution session when operator action is
    // canonically required.
    it('limits compact continue to a valid existing same-Issue Execution session', () => {
      expect(continuation).toMatch(/existing active Execution\/IDE session for the same Issue.*compact operator action.*`continue`/i)
      expect(continuation).toMatch(/cross.session operator action is actually required.*session remains the valid continuation target/i)
      expect(continuation).toMatch(/must not use this compact continuation form to start a new Issue or a new Execution session/i)
    })

    // Authority: Global MC reconstructs GitHub state itself, so a bare Issue
    // number remains sufficient for a new Global MC chat.
    it('keeps bare-Issue reconstruction valid for a new Global MC chat', () => {
      expect(continuation).toMatch(/new Global MC reconstruction.*bare Issue number.*remains sufficient/i)
      expect(continuation).toMatch(/bare.Issue shortcut does not apply to a new Execution\/IDE handoff/i)
    })

    // Authority: the Founder direction in Issue #512 comment 5998215788
    // requires resolving unknown destination identity or failing toward the
    // complete artifact, never silently selecting the short form.
    it('fails closed when the Execution destination session is ambiguous', () => {
      expect(continuation).toMatch(/cannot prove whether the destination is a new Execution session or an existing valid same.Issue session/i)
      expect(continuation).toMatch(/must not choose the shortened form.*full canonical Execution artifact or resolve the session identity first/i)
    })

    // Authority: sections 1-2 of the Founder direction in Issue #512 comment
    // 5993511230 require one wholly copyable artifact; presentation adds no
    // authority or semantic changes.
    it('keeps a complete operator artifact in one copy-ready container', () => {
      expect(contract).toMatch(/complete copy.ready operator artifact.*one dedicated copyable container supported by the active client/i)
      expect(contract).toMatch(/in ChatGPT.*writing block.*native Copy affordance/i)
      expect(contract).toMatch(/do not place substantive parts of one artifact partly in prose and partly inside the copyable container/i)
      expect(contract).toMatch(/rendering in a copyable container grants no workflow authority.*must not alter Context/i)
    })

    // Authority: loader progressive disclosure loads the Execution contract
    // when that phase triggers; it does not permit omitting the loaded rules.
    it('loads the full Execution contract when the handoff phase is triggered', () => {
      expect(loader).toMatch(/Execution handoff: load `docs\/mission-control\/execution-handoff-contract\.md`/i)
      expect(contract).toMatch(/progressive disclosure means load the full Execution contract when the Execution.handoff phase is triggered/i)
      expect(contract).toMatch(/does not mean omitting the triggered contract/i)
    })
  })

  describe('Ready-to-paste continuation UX', () => {
    const contract = read('docs/mission-control/execution-handoff-contract.md')
    const loader = read('prompts/mission-control/chatgpt-project-loader.md')
    const continuation = artifactSection('Continuation rule')

    it('emits a compact copy-ready continuation in the same response after REVIEW when the same Execution destination remains valid', () => {
      expect(contract).toMatch(/after REVIEW or another durable result.*same valid Execution session, workspace, and authority.*compact continuation in that same response/i)
      // Authority: the same-response transfer invariant applies even to the
      // compact same-session case. The copy-ready artifact itself must carry
      // identity and the exact action; a bare `continue` or surrounding prose
      // cannot supply either requirement. The valid case still avoids 15 sections.
      expect(contract).toMatch(/After REVIEW or another durable result.*same valid Execution session.*emit the compact continuation in that same response/i)
      expect(contract).toMatch(/current response MUST contain the required self-contained copy-ready operator artifact itself.*artifact itself MUST identify the repository, Issue, and exact next action/i)
      expect(contract).toMatch(/Status, explanation, or wording such as "continue there" without that artifact is incomplete/i)
      expect(continuation).toMatch(/existing active Execution\/IDE session for the same Issue.*compact operator action.*`continue`/i)
      expect(continuation).toMatch(/full 15-section handoff.*valid same-session case.*MUST NOT be used when the compact continuation is sufficient/i)
      expect(loader).toMatch(/existing Execution\/IDE session.*send `continue`.*already-authorized/i)
    })

    it('emits the complete canonical handoff in the same response for a new Execution session', () => {
      expect(continuation).toMatch(/new Execution\/IDE session.*MUST emit.*complete canonical Ready-to-paste.*all 15 ordered sections/i)
      expect(contract).toMatch(/new session, changed execution workspace, or changed authority context.*complete canonical 15-section handoff in that same response/i)
    })

    it('keeps prepared wrong-workspace host rebind to the exact verified path instead of inventing Founder Git commands', () => {
      expect(contract).toMatch(/workspace-acquisition rule.*prepared and verified a sibling workspace.*exact verified path and exact operator rebind\/open action/i)
      expect(contract).toMatch(/do not ask the Founder to run Git clone\/fetch\/checkout commands/i)
      expect(contract).toMatch(/canonical recovery actions remain narrower than objective handoffs/i)
    })

    it('keeps FOUNDER_GATE decision-first instead of fabricating a continuation', () => {
      expect(contract).toMatch(/FOUNDER_GATE.*decision-first.*ask for the actual Founder decision.*do not emit a mutation-capable continuation that assumes the answer/i)
      expect(loader).toMatch(/`FOUNDER_GATE` means no mutation and return to Founder once for the required decision/i)
    })

    it('emits the appropriate continuation in the same response after a Founder decision when another runtime must act', () => {
      expect(contract).toMatch(/after the Founder decision exists.*another session or runtime must carry it out.*copy-ready continuation in that same response/i)
      expect(contract).toMatch(/after the Founder decision exists.*another session or runtime must carry it out.*same response/i)
    })

    it('prefers direct execution when the current agent can perform the authorized action', () => {
      expect(contract).toMatch(/current agent\/runtime can execute the authorized next action directly.*perform it directly instead.*do not manufacture a handoff/i)
      expect(contract).toMatch(/current agent\/runtime can execute the authorized next action directly.*perform it directly instead/i)
    })

    it('rejects transfer prose without the required copy-ready artifact', () => {
      expect(contract).toMatch(/selected next action requires another session or runtime to act.*current response MUST contain.*copy-ready operator artifact itself/i)
      expect(contract).toMatch(/continue there.*without that artifact is incomplete.*do not make the Founder ask a second time/i)
      expect(loader).toMatch(/existing Execution\/IDE session, send `continue` for already-authorized objective; this response's copy-ready artifact names repository, Issue, and exact next action/i)
    })

    it('keeps repository, Issue, and exact next action inside the transfer artifact rather than surrounding prose', () => {
      expect(contract).toMatch(/artifact itself MUST identify the repository, Issue, and exact next action.*without substantive surrounding prose/i)
      expect(contract).toMatch(/splits repository\/Issue\/ next-action identity into surrounding prose/i)
    })

    it('rejects compact continuation for a new session, changed workspace, or changed authority', () => {
      expect(continuation).toMatch(/MUST NOT use this compact continuation form to start a new Issue or a new Execution session.*changed execution workspace.*changed authority context/i)
      expect(contract).toMatch(/compact continuation in any of those cases is invalid/i)
    })

    it('rejects the full handoff as avoidable overhead when a valid same-session compact continuation is sufficient', () => {
      expect(continuation).toMatch(/full 15-section handoff.*valid same-session case.*avoidable operator overhead.*MUST NOT be used.*compact continuation is sufficient/i)
      expect(contract).toMatch(/emits the full canonical handoff when the valid same-session compact continuation is sufficient violates this response contract/i)
    })
  })

  it('keeps all applicable model roles and escalation inside the artifact', () => {
    const artifact = artifactSection('Model routing')
    for (const role of [
      'controller', 'read_only_characterization', 'implementation',
      'deterministic_verification', 'independent_semantic_delta_review', 'escalation',
    ]) expect(artifact).toContain(role)
    expect(artifact).toMatch(/NOT_APPLICABLE.*reason/i)
    expect(artifact).toMatch(/Model Routing Profile v1/i)
    expect(artifact).toMatch(/resolved values for all five fields/i)
    expect(artifact).toMatch(/independent reviewer.*differ.*controller.*implementer/i)
    expect(artifact).toMatch(/advisory only/i)
    expect(artifact).toMatch(/model identity.*authority/i)
    expect(artifact).toMatch(/for every applicable role.*resolved values.*model_class.*effort.*rationale.*escalation_trigger/i)
    expect(artifact).toMatch(/mark an unused role.*NOT_APPLICABLE.*specific reason/i)
    expect(artifact).toMatch(/escalation guidance with.*model_class.*effort.*triggers?.*or mark escalation.*NOT_APPLICABLE.*specific reason/i)
    expect(artifact).toMatch(/self-check.*each role and escalation has resolved values/i)
  })

  it('carries deterministic COMMAND continuation without internal-substep ping-pong', () => {
    const artifact = artifactSection('Continuation rule')
    expect(artifact).toMatch(/fresh GitHub.*merged policy.*applicable CLI Discovery.*fresh Context.*recompute route/i)
    expect(artifact).toMatch(/COMMAND.*continue automatically.*same controller session/i)
    expect(artifact).toMatch(/FOUNDER_GATE.*return to Founder/i)
    expect(artifact).toMatch(/STOP.*unsupported.*evidence conflict.*stop/i)
    expect(artifact).toMatch(/none of these internal steps alone requires a Founder return/i)
    for (const step of [
      'CLI Discovery', 'zero-delta branch bootstrap', 'Context rerun',
      'HANDOFF readback', 'deterministic inventory',
    ]) expect(artifact).toContain(step)
  })

  it('forbids mutation-capable instructions at STOP and FOUNDER_GATE', () => {
    const stop = artifactSection('Stop conditions')
    const founder = artifactSection('Founder decision status')
    expect(stop).toMatch(/STOP.*FOUNDER_GATE.*no mutation/i)
    expect(stop).toMatch(/implementation.*NOT_APPLICABLE/i)
    expect(founder).toMatch(/human decision.*no worker.*cross/i)
  })

  it('requires fresh Context before each next objective and keeps real gates as Founder returns', () => {
    const continuation = artifactSection('Continuation rule')
    const freshContext = artifactSection('Fresh Context requirement')
    const durableHandoff = artifactSection('Durable result / HANDOFF / readback')
    expect(continuation).toMatch(/do not pre-authorize future objectives/i)
    expect(continuation).toMatch(/separately bounded objective(?:s)?/i)
    expect(continuation).toMatch(/after each durable objective and applicable HANDOFF\/readback.*fresh GitHub.*merged policy.*applicable CLI Discovery.*fresh Context.*recompute route/i)
    expect(continuation).toMatch(/FOUNDER_GATE.*return to Founder.*STOP.*terminal/i)
    expect(freshContext).toMatch(/before selecting the next objective/i)
    expect(durableHandoff).toMatch(/Handoff.*readback/i)
    expect(read('docs/mission-control/execution-handoff-contract.md')).toMatch(/static repository tests.*do not prove.*live Global MC session/i)
    const template = readyToPasteArtifactContract()
    expect(template).not.toMatch(/whether callable runtime integration was proven/i)
    expect(read('prompts/mission-control/chatgpt-project-loader.md')).not.toMatch(/#512|#532/)
  })

  it('requires reconstruction, scope, validation, and report details beyond section headings', () => {
    expect(artifactSection('Repository / Issue / PR identity')).toMatch(/exact head.*protected base.*policy identity/i)
    expect(artifactSection('Startup / reconstruction instructions')).toMatch(/load the merged policy.*registered CLI Discovery with its declared safe help.*fresh.*bemoat:context/i)
    expect(artifactSection('Permitted scope')).toMatch(/current objective.*does not authorize.*future Issue/i)
    expect(artifactSection('Prohibited scope')).toMatch(/production.*migration.*secret.*deploy.*merge.*unrelated/i)
    expect(artifactSection('Validation requirements')).toMatch(/focused regressions.*repository-required validation tier.*exact commands and results.*exact-head CI and independent review.*policy requires/i)
    const report = artifactSection('Required return contract')
    for (const field of [
      'repository/protected-base/policy identity', 'fresh Context route', 'acceptance audit',
      'branch/exact head', 'changed files and diff size', 'focused regressions',
      'full required validation', 'PR and exact-head CI', 'independent review',
      'HANDOFF/readback', 'fresh Context after the result', 'risks', 'Founder decision',
    ]) expect(report).toContain(field)
  })

  it('keeps delegated work within one accountable objective and preserves independent gates', () => {
    const guide = read('docs/mission-control/mission-control-guide.md')
    expect(guide).toMatch(/one accountable controller per bounded objective/i)
    expect(guide).toMatch(/delegat(?:e|es).*bounded internal.*read-only.*non-overlapping.*deterministic/i)
    expect(guide).toMatch(/retains? responsibility for.*objective.*authority.*routing.*evidence.*acceptance criteria.*durable delivery.*fresh Context/i)
    expect(guide).toMatch(/workers?.*no new authority.*cannot.*future objectives.*cross.*gates/i)
    expect(guide).toMatch(/multiple read-only.*non-overlapping workers?.*do not.*bundle/i)
    expect(guide).toMatch(/mutation ownership.*unambiguous.*overlapping.*prohibited/i)
    expect(guide).toMatch(/independent review.*remains? independent/i)
    expect(guide).toMatch(/agnostic to provider and model identity/i)
    expect(guide).not.toMatch(/keep one capable worker through deterministic internal steps/i)
    expect(guide).toMatch(/when useful.*same capable worker through a coherent inspect\/implement\/focused-check\/correction chain.*authorized delivery steps/i)
  })

  describe('explicit execution controller and advisory baseline', () => {
    it('reports an explicit current controller in the operator summary and Section 7', () => {
      const loader = read('prompts/mission-control/chatgpt-project-loader.md')
      const routing = artifactSection('Model routing')

      expect(loader.replace(/\s+/g, ' ')).toMatch(/on explicit controller selection, name the actual controller first in the six.field summary and Section 7; label a different profile value advisory baseline only/i)
      expect(routing).toMatch(/Sol Medium advisory baseline.*Luna XHigh.*actual controller.*Sol Medium.*advisory baseline/i)
      expect(routing).toMatch(/must not downgrade or replace the explicit selection because the advisory baseline differs/i)
    })

    it('never presents the advisory profile as binding execution or workflow authority', () => {
      const routing = artifactSection('Model routing')

      expect(routing).toMatch(/never describe.*advisory profile recommendation as workflow or model.execution authority/i)
      expect(routing).toMatch(/do not say or imply.*governs.*binds.*prevents/i)
    })

    it('keeps the advisory controller recommendation usable when no controller is explicitly selected', () => {
      const routing = artifactSection('Model routing')
      expect(routing).toMatch(/without an explicit current.execution controller selection.*advisory profile.*controller default may be presented as the recommendation/i)
      expect(routing).toMatch(/future target policy.*only when the active Issue changes the advisory defaults.*otherwise.*NOT_APPLICABLE/i)
    })

    it('does not let controller selection change Context authority, routes, or gates', () => {
      expect(artifactSection('Model routing')).toMatch(/explicit controller selection.*does not change Context authority, routes, gates, repository policy, or acceptance criteria/i)
    })

    it('keeps the independent semantic reviewer separate from the controller and implementer', () => {
      expect(artifactSection('Model routing')).toMatch(/independent semantic.*reviewer.*remain separate from.*actual controller and implementer/i)
    })
  })

  describe('advisory Model Routing Profile v1', () => {
    const profile = () => {
      const loader = readFileSync(resolve(root, 'docs/mission-control/model-routing-profile.md'), 'utf8')
      const block = loader.match(/```json\s*([\s\S]*?)```/)
      expect(block, 'the existing loader exposes the advisory profile').not.toBeNull()
      return JSON.parse(block![1]!)
    }

    it('limits recommendation inputs and outputs without granting workflow authority', () => {
      const contract = profile()
      expect(contract.authority).toBe('advisory_only')
      expect(contract.inputs).toEqual([
        'deterministic_or_semantic', 'read_only_or_mutation',
        'complexity_or_ambiguity', 'blast_radius', 'reviewer_independence',
      ])
      expect(contract.output_fields).toEqual([
        'role', 'model_class', 'effort', 'rationale', 'escalation_trigger',
      ])
      expect(contract.forbidden_effects).toEqual([
        'change_context_route', 'create_authority', 'reinterpret_stop_or_founder_gate',
        'bypass_founder_approval', 'bypass_exact_head_ci', 'bypass_independent_review',
        'bypass_required_handoff_or_readback', 'authorize_next_objective',
        'start_dependent_or_future_work',
      ])
    })

    it('covers exactly the five supported roles with sufficient versionless defaults', () => {
      const contract = profile()
      expect(contract.defaults.map((entry: Record<string, string>) => [entry.role, entry.model_class, entry.effort])).toEqual([
        ['controller', 'Sol', 'Medium'],
        ['read_only_characterization', 'Luna', 'Medium'],
        ['implementation', 'Luna', 'High'],
        ['deterministic_verification', 'Luna', 'Medium'],
        ['independent_semantic_delta_review', 'Sol', 'Medium'],
      ])
      for (const recommendation of contract.defaults) {
        expect(Object.keys(recommendation).sort()).toEqual([...contract.output_fields].sort())
        expect(recommendation.rationale.trim().length).toBeGreaterThan(0)
        expect(recommendation.escalation_trigger.trim().length).toBeGreaterThan(0)
      }
    })

    it('restricts escalation and prevents controller or implementer reuse as independent reviewer', () => {
      const contract = profile()
      expect(contract.escalation).toEqual({
        model_class: 'Sol', effort: 'High',
        triggers: ['ambiguity', 'conflicting_evidence', 'policy_or_spec_boundary'],
      })
      expect(contract.independent_reviewer_excludes).toEqual(['controller', 'implementer'])
    })
  })
})
