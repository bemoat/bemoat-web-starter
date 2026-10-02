import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\s+/g, ' ')

describe('Mission Control delegation and execution model policy', () => {
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

  describe('advisory Model Routing Profile v1', () => {
    const profile = () => {
      const loader = readFileSync(resolve(root, 'prompts/mission-control/chatgpt-project-loader.md'), 'utf8')
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
