/**
 * Planning Agent - Task decomposition and orchestration
 * Implements the Planning (Orchestrator-Workers) Pattern
 */

import { AgentResponse, TaskInput, MCPTool } from '../types/index.js'
import { LLMManager } from '../llm/index.js'

export interface PlanningConfig {
  maxSubtasks: number
  model?: string
  temperature?: number
}

export interface Subtask {
  id: string
  description: string
  type: SubtaskType
  dependencies: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
}

export type SubtaskType =
  | 'research'
  | 'analysis'
  | 'design'
  | 'implementation'
  | 'testing'
  | 'documentation'
  | 'validation'

export interface Plan {
  approach: string
  reasoning: string
  subtasks: Subtask[]
  estimatedTime?: number
}

export interface SubtaskResult {
  subtaskId: string
  success: boolean
  output: string
  error?: string
}

export class PlanningAgent {
  private llmManager: LLMManager
  private config: PlanningConfig
  private tools: Map<string, MCPTool> = new Map()

  constructor(llmManager: LLMManager, config?: Partial<PlanningConfig>) {
    this.llmManager = llmManager
    this.config = {
      maxSubtasks: config?.maxSubtasks ?? 7,
      model: config?.model,
      temperature: config?.temperature ?? 0.7,
    }
  }

  /**
   * Register tool for subtask execution
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Execute task with planning
   */
  async execute(input: TaskInput): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      // 1. Create plan
      console.log('[Planning] Creating execution plan...')
      const plan = await this.createPlan(input)

      console.log(`[Planning] Plan created with ${plan.subtasks.length} subtasks`)
      console.log(`[Planning] Approach: ${plan.approach}`)

      // 2. Execute subtasks in dependency order
      const results = await this.executeSubtasks(plan)

      // 3. Synthesize results
      console.log('[Planning] Synthesizing results...')
      const finalOutput = await this.synthesize(results, input.task, plan)

      const successCount = results.filter((r) => r.success).length

      return {
        success: successCount === results.length,
        output: finalOutput,
        metadata: {
          agent: 'planning',
          pattern: 'planning',
          iterations: plan.subtasks.length,
          duration: Date.now() - startTime,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        userCancelled: error.name === 'PermissionDeniedError',
      }
    }
  }

  /**
   * Create execution plan
   */
  private async createPlan(input: TaskInput): Promise<Plan> {
    const planningPrompt = `Task: ${input.task}

Create a detailed execution plan to accomplish this task.

Break down into 3-${this.config.maxSubtasks} concrete subtasks. For each subtask:
1. Provide a specific, actionable description
2. Specify type: research, analysis, design, implementation, testing, documentation, or validation
3. List dependencies (IDs of subtasks that must complete first, or empty array)
4. Set priority: critical, high, medium, or low

Also specify:
- Overall approach (explain your strategy)
- Reasoning (why this approach)

Respond in JSON format:
{
  "approach": "brief approach description",
  "reasoning": "why this approach works",
  "subtasks": [
    {
      "id": "task-1",
      "description": "specific actionable task",
      "type": "research|analysis|design|implementation|testing|documentation|validation",
      "dependencies": [],
      "priority": "critical|high|medium|low"
    }
  ]
}`

    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content:
              'You are a planning expert. Create clear, logical execution plans in valid JSON format.',
          },
          {
            role: 'user',
            content: planningPrompt,
          },
        ],
        model: this.config.model,
        temperature: 0.5, // Lower temperature for consistent planning
      },
      'anthropic'
    )

    try {
      // Extract JSON from response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in planning response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      // Convert to Plan with status
      const plan: Plan = {
        approach: parsed.approach,
        reasoning: parsed.reasoning,
        subtasks: parsed.subtasks.map((st: any) => ({
          ...st,
          status: 'pending' as const,
        })),
      }

      // Validate plan
      if (plan.subtasks.length === 0) {
        throw new Error('Plan has no subtasks')
      }

      if (plan.subtasks.length > this.config.maxSubtasks) {
        // Trim to max
        plan.subtasks = plan.subtasks.slice(0, this.config.maxSubtasks)
      }

      return plan
    } catch (error) {
      console.error('[Planning] Plan parsing error:', error)
      // Fallback: create simple plan
      return {
        approach: 'direct-execution',
        reasoning: 'Fallback to direct execution due to planning error',
        subtasks: [
          {
            id: 'task-1',
            description: input.task,
            type: 'implementation',
            dependencies: [],
            priority: 'critical',
            status: 'pending',
          },
        ],
      }
    }
  }

  /**
   * Execute subtasks in dependency order
   */
  private async executeSubtasks(plan: Plan): Promise<SubtaskResult[]> {
    const results: SubtaskResult[] = []
    const completed = new Set<string>()

    // Build execution waves based on dependencies
    const waves = this.buildExecutionWaves(plan.subtasks)

    for (let i = 0; i < waves.length; i++) {
      const wave = waves[i]
      console.log(`[Planning] Executing wave ${i + 1} (${wave.length} tasks)`)

      // Execute wave tasks in parallel
      const waveResults = await Promise.all(
        wave.map(async (subtaskId) => {
          const subtask = plan.subtasks.find((st) => st.id === subtaskId)!
          subtask.status = 'in-progress'

          const result = await this.executeSubtask(subtask, results)

          if (result.success) {
            subtask.status = 'completed'
            completed.add(subtaskId)
          } else {
            subtask.status = 'failed'
          }

          return result
        })
      )

      results.push(...waveResults)

      // Check for failures in critical tasks
      const criticalFailures = waveResults.filter(
        (r) =>
          !r.success &&
          plan.subtasks.find((st) => st.id === r.subtaskId)?.priority === 'critical'
      )

      if (criticalFailures.length > 0) {
        console.log('[Planning] Critical task failed, stopping execution')
        break
      }
    }

    return results
  }

  /**
   * Build execution waves based on dependencies
   */
  private buildExecutionWaves(subtasks: Subtask[]): string[][] {
    const waves: string[][] = []
    const completed = new Set<string>()

    while (completed.size < subtasks.length) {
      const wave = subtasks
        .filter((st) => {
          if (completed.has(st.id)) return false
          return st.dependencies.every((dep) => completed.has(dep))
        })
        .map((st) => st.id)

      if (wave.length === 0) {
        // Check for circular dependencies or orphaned tasks
        const remaining = subtasks.filter((st) => !completed.has(st.id))
        if (remaining.length > 0) {
          console.warn('[Planning] Circular dependency or orphaned tasks detected')
          // Force execute remaining tasks
          waves.push(remaining.map((st) => st.id))
        }
        break
      }

      waves.push(wave)
      wave.forEach((id) => completed.add(id))
    }

    return waves
  }

  /**
   * Execute a single subtask
   */
  private async executeSubtask(
    subtask: Subtask,
    previousResults: SubtaskResult[]
  ): Promise<SubtaskResult> {
    console.log(`[Planning] Executing: ${subtask.description}`)

    try {
      // Build context from previous results
      const context = previousResults
        .filter((r) => subtask.dependencies.includes(r.subtaskId) && r.success)
        .map((r) => `${r.subtaskId}: ${r.output}`)
        .join('\n\n')

      const prompt = `Subtask: ${subtask.description}
Type: ${subtask.type}
Priority: ${subtask.priority}

${context ? `Context from previous steps:\n${context}\n\n` : ''}Execute this subtask and provide the result.`

      const response = await this.llmManager.generate(
        {
          messages: [
            {
              role: 'system',
              content: `You are executing a subtask as part of a larger plan.
Be specific and thorough. Provide actionable output.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: this.config.model,
          temperature: this.config.temperature,
        },
        'anthropic'
      )

      return {
        subtaskId: subtask.id,
        success: true,
        output: response.text,
      }
    } catch (error: any) {
      return {
        subtaskId: subtask.id,
        success: false,
        output: '',
        error: error.message,
      }
    }
  }

  /**
   * Synthesize subtask results into final output
   */
  private async synthesize(
    results: SubtaskResult[],
    originalTask: string,
    plan: Plan
  ): Promise<string> {
    const resultsText = results
      .map((r, i) => {
        const subtask = plan.subtasks[i]
        return `## ${subtask.description}
Status: ${r.success ? '✓ Success' : '✗ Failed'}
${r.success ? r.output : `Error: ${r.error}`}`
      })
      .join('\n\n')

    const synthesisPrompt = `Original Task: ${originalTask}

Approach Used: ${plan.approach}

Subtask Results:
${resultsText}

Synthesize these results into a cohesive, complete solution that addresses the original task.
Ensure consistency across all subtask outputs and provide a clear, actionable final answer.`

    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content:
              'You are synthesizing multiple subtask results into a final solution. Be thorough and cohesive.',
          },
          {
            role: 'user',
            content: synthesisPrompt,
          },
        ],
        model: this.config.model,
        temperature: this.config.temperature,
      },
      'anthropic'
    )

    return response.text
  }

  /**
   * Get plan visualization
   */
  visualizePlan(plan: Plan): string {
    let viz = `Plan: ${plan.approach}\n\n`

    plan.subtasks.forEach((st, i) => {
      const status = {
        pending: '○',
        'in-progress': '◐',
        completed: '●',
        failed: '✗',
      }[st.status]

      viz += `${i + 1}. ${status} ${st.description}\n`
      viz += `   Type: ${st.type} | Priority: ${st.priority}\n`

      if (st.dependencies.length > 0) {
        viz += `   Depends on: ${st.dependencies.join(', ')}\n`
      }

      viz += '\n'
    })

    return viz
  }
}
