/**
 * Multi-Agent Coordinator
 * Orchestrates specialist agents for complex tasks
 */

import { LLMManager } from '../../llm/index.js'
import { TaskInput, AgentResponse } from '../../types/index.js'
import { IterationManager } from '../../core/iteration-manager.js'
import { BaseSpecialistAgent } from './base-specialist.js'
import { SecurityAgent } from './specialists/security-agent.js'
import { PerformanceAgent } from './specialists/performance-agent.js'
import { TestingAgent } from './specialists/testing-agent.js'
import {
  Specialty,
  SpecializedTask,
  SpecialistResult,
  CollaborationPlan,
  CollaborationPhase,
} from './types.js'

export interface AgentActivity {
  id: string
  specialty: string
  status: 'active' | 'waiting' | 'completed'
  tokensUsed: number
  currentTask?: string
}

export class MultiAgentCoordinator {
  private llmManager: LLMManager
  private specialists: Map<Specialty, BaseSpecialistAgent> = new Map()
  private iterationManager?: IterationManager
  private activeAgents: Map<string, AgentActivity> = new Map()
  private onAgentUpdate?: (agents: AgentActivity[]) => void

  constructor(llmManager: LLMManager) {
    this.llmManager = llmManager
    this.initializeSpecialists()
  }

  /**
   * Initialize specialist agents
   */
  private initializeSpecialists(): void {
    this.specialists.set('security', new SecurityAgent(this.llmManager))
    this.specialists.set('performance', new PerformanceAgent(this.llmManager))
    this.specialists.set('testing', new TestingAgent(this.llmManager))
  }

  /**
   * Set iteration manager for progress tracking
   */
  setIterationManager(manager: IterationManager): void {
    this.iterationManager = manager
  }

  /**
   * Set callback for agent activity updates
   */
  setAgentUpdateCallback(callback: (agents: AgentActivity[]) => void): void {
    this.onAgentUpdate = callback
  }

  /**
   * Get current active agents
   */
  getActiveAgents(): AgentActivity[] {
    return Array.from(this.activeAgents.values())
  }

  /**
   * Update agent activity and notify
   */
  private updateAgentActivity(
    agentId: string,
    specialty: string,
    updates: Partial<AgentActivity>
  ): void {
    const current = this.activeAgents.get(agentId) || {
      id: agentId,
      specialty,
      status: 'waiting' as const,
      tokensUsed: 0,
    }

    const updated = { ...current, ...updates }
    this.activeAgents.set(agentId, updated)

    if (this.onAgentUpdate) {
      this.onAgentUpdate(this.getActiveAgents())
    }
  }

  /**
   * Execute multi-agent collaboration
   */
  async execute(input: TaskInput): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      // Clear previous agent activities
      this.activeAgents.clear()

      // 1. Analyze task and identify required specialists
      const requiredSpecialties = await this.identifyRequiredSpecialists(input)

      if (requiredSpecialties.length === 0) {
        return {
          success: false,
          output: '',
          error: 'No specialists identified for this task',
        }
      }

      // 2. Create collaboration plan
      const plan = await this.createCollaborationPlan(input, requiredSpecialties)

      // 3. Execute plan with specialists
      const results = await this.executeCollaborationPlan(plan, input)

      // 4. Synthesize results
      const synthesizedOutput = await this.synthesizeResults(results, input)

      // Calculate total tokens
      const totalTokens = this.getActiveAgents().reduce((sum, a) => sum + a.tokensUsed, 0)

      return {
        success: true,
        output: synthesizedOutput,
        metadata: {
          agent: 'multi-agent-coordinator',
          pattern: 'multi-agent',
          tokensUsed: totalTokens,
          duration: Date.now() - startTime,
          agentsUsed: requiredSpecialties,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
      }
    }
  }

  /**
   * Identify which specialists are needed
   */
  private async identifyRequiredSpecialists(input: TaskInput): Promise<Specialty[]> {
    const task = input.task.toLowerCase()
    const required: Specialty[] = []

    // Security keywords
    if (
      /security|auth|encrypt|vuln|xss|sql inject|csrf/.test(task) ||
      /password|token|session|secure/.test(task)
    ) {
      required.push('security')
    }

    // Performance keywords
    if (
      /performance|optimize|slow|fast|cache|scale/.test(task) ||
      /bottleneck|speed|efficient/.test(task)
    ) {
      required.push('performance')
    }

    // Testing keywords
    if (/test|coverage|qa|quality|bug/.test(task) || /unit test|integration test/.test(task)) {
      required.push('testing')
    }

    // If it's a complex code generation task, include all specialists for review
    if (
      /build|create|implement|develop/.test(task) &&
      /system|application|feature|complete/.test(task)
    ) {
      if (!required.includes('security')) required.push('security')
      if (!required.includes('performance')) required.push('performance')
      if (!required.includes('testing')) required.push('testing')
    }

    return required
  }

  /**
   * Create collaboration plan
   */
  private async createCollaborationPlan(
    input: TaskInput,
    specialties: Specialty[]
  ): Promise<CollaborationPlan> {
    const phases: CollaborationPhase[] = []

    // Determine if task is code generation or code review
    const isGeneration = /build|create|implement|develop|write/.test(input.task.toLowerCase())
    const isReview = /review|audit|analyze|check/.test(input.task.toLowerCase())

    if (isGeneration) {
      // Generation flow: Create code, then review in parallel
      phases.push({
        id: 'generation',
        name: 'Code Generation',
        agents: [], // Main agent handles this
        task: 'Generate initial implementation',
        parallel: false,
      })

      phases.push({
        id: 'review',
        name: 'Multi-Agent Review',
        agents: specialties,
        task: 'Review and improve generated code',
        dependencies: ['generation'],
        parallel: true, // All agents review in parallel
      })
    } else {
      // Review/Analysis flow: All agents work in parallel
      phases.push({
        id: 'analysis',
        name: 'Multi-Agent Analysis',
        agents: specialties,
        task: input.task,
        parallel: true,
      })
    }

    return {
      phases,
      overallGoal: input.task,
    }
  }

  /**
   * Execute collaboration plan
   */
  private async executeCollaborationPlan(
    plan: CollaborationPlan,
    input: TaskInput
  ): Promise<SpecialistResult[]> {
    const allResults: SpecialistResult[] = []

    for (const phase of plan.phases) {
      if (this.iterationManager) {
        const step = this.iterationManager.addStep(`Phase: ${phase.name}`)
        this.iterationManager.updateStep(step.id, { status: 'in_progress', progress: 0.5 })
      }

      const phaseResults = await this.executePhase(phase, input, allResults)
      allResults.push(...phaseResults)

      if (this.iterationManager) {
        const step = this.iterationManager.getCurrentCycle()?.steps.slice(-1)[0]
        if (step) {
          this.iterationManager.updateStep(step.id, { status: 'completed', progress: 1 })
        }
      }
    }

    return allResults
  }

  /**
   * Execute a single phase
   */
  private async executePhase(
    phase: CollaborationPhase,
    input: TaskInput,
    previousResults: SpecialistResult[]
  ): Promise<SpecialistResult[]> {
    if (phase.agents.length === 0) {
      return []
    }

    const tasks = phase.agents.map((specialty) => ({
      id: `${phase.id}-${specialty}`,
      description: `${phase.task} (${specialty} perspective)`,
      context: {
        originalTask: input.task,
        previousResults: previousResults.map((r) => ({
          specialty: r.specialty,
          summary: r.output.substring(0, 500), // First 500 chars
        })),
      },
    }))

    // Initialize agent activities
    for (const task of tasks) {
      const specialty = task.id.split('-').slice(-1)[0] as Specialty
      this.updateAgentActivity(task.id, specialty, {
        status: 'waiting',
        currentTask: task.description,
        tokensUsed: 0,
      })
    }

    if (phase.parallel) {
      // Execute all agents in parallel
      return await Promise.all(
        tasks.map(async (task, idx) => {
          const specialty = phase.agents[idx]
          const agent = this.specialists.get(specialty)

          if (!agent) {
            throw new Error(`Specialist not found: ${specialty}`)
          }

          // Mark as active
          this.updateAgentActivity(task.id, specialty, { status: 'active' })

          const result = await agent.execute(task)

          // Mark as completed with token usage
          this.updateAgentActivity(task.id, specialty, {
            status: 'completed',
            tokensUsed: result.metadata?.tokensUsed || 0,
          })

          return result
        })
      )
    } else {
      // Execute sequentially
      const results: SpecialistResult[] = []

      for (let i = 0; i < tasks.length; i++) {
        const specialty = phase.agents[i]
        const agent = this.specialists.get(specialty)

        if (!agent) {
          throw new Error(`Specialist not found: ${specialty}`)
        }

        // Mark as active
        this.updateAgentActivity(tasks[i].id, specialty, { status: 'active' })

        const result = await agent.execute(tasks[i])

        // Mark as completed with token usage
        this.updateAgentActivity(tasks[i].id, specialty, {
          status: 'completed',
          tokensUsed: result.metadata?.tokensUsed || 0,
        })

        results.push(result)
      }

      return results
    }
  }

  /**
   * Synthesize results from multiple specialists
   */
  private async synthesizeResults(
    results: SpecialistResult[],
    input: TaskInput
  ): Promise<string> {
    if (results.length === 0) {
      return 'No specialist results to synthesize.'
    }

    // Compile all specialist outputs
    const sections: string[] = []

    sections.push(`# Multi-Agent Analysis: ${input.task}\n`)
    sections.push(`Analyzed by ${results.length} specialist agent(s):\n`)

    for (const result of results) {
      sections.push(`\n## ${result.specialty.toUpperCase()} Analysis`)
      sections.push(`Confidence: ${(result.confidence * 100).toFixed(1)}%\n`)
      sections.push(result.output)
      sections.push('\n---')
    }

    // Add synthesis summary
    sections.push('\n## Synthesis\n')

    const specialtyList = results.map((r) => r.specialty).join(', ')
    sections.push(
      `This analysis was performed by ${results.length} specialized agents (${specialtyList}), `
    )
    sections.push('each bringing their unique expertise to provide a comprehensive assessment.\n')

    // Highlight high-confidence findings
    const highConfidence = results.filter((r) => r.confidence >= 0.8)
    if (highConfidence.length > 0) {
      sections.push('\n### High-Confidence Findings:\n')
      for (const result of highConfidence) {
        sections.push(
          `- **${result.specialty}** (${(result.confidence * 100).toFixed(0)}% confidence): ` +
            `Found critical insights\n`
        )
      }
    }

    return sections.join('\n')
  }

  /**
   * Get available specialists
   */
  getAvailableSpecialists(): Specialty[] {
    return Array.from(this.specialists.keys())
  }
}
