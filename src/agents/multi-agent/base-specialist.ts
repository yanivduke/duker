/**
 * Base Specialist Agent
 * All specialized agents extend this base class
 */

import { LLMManager } from '../../llm/index.js'
import {
  Specialty,
  SpecializedTask,
  SpecialistResult,
  AgentCapability,
  AgentMessage,
} from './types.js'

export abstract class BaseSpecialistAgent {
  protected llmManager: LLMManager
  public readonly id: string
  public readonly specialty: Specialty
  public readonly capabilities: AgentCapability[]

  constructor(
    llmManager: LLMManager,
    specialty: Specialty,
    capabilities: AgentCapability[]
  ) {
    this.llmManager = llmManager
    this.id = `${specialty}-${Date.now()}`
    this.specialty = specialty
    this.capabilities = capabilities
  }

  /**
   * Execute specialized task
   */
  abstract execute(task: SpecializedTask): Promise<SpecialistResult>

  /**
   * Get agent's system prompt
   */
  protected abstract getSystemPrompt(): string

  /**
   * Process messages from other agents
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage | null> {
    // Default implementation - can be overridden
    if (message.type === 'request') {
      return {
        from: this.id,
        to: message.from,
        type: 'response',
        content: `${this.specialty} agent received your request`,
        timestamp: Date.now(),
      }
    }
    return null
  }

  /**
   * Collaborate with another agent
   */
  async collaborate(task: SpecializedTask, partnerId: string): Promise<void> {
    console.log(`[${this.specialty}] Collaborating with ${partnerId} on ${task.id}`)
  }

  /**
   * Generate LLM-based response
   */
  protected async generateResponse(
    task: SpecializedTask,
    additionalContext?: string
  ): Promise<string> {
    const context = additionalContext || ''

    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: `${context}\n\nTask: ${task.description}${
              task.context ? `\n\nContext: ${JSON.stringify(task.context, null, 2)}` : ''
            }`,
          },
        ],
        temperature: 0.7,
      },
      'anthropic'
    )

    return response.text
  }

  /**
   * Evaluate confidence in result
   */
  protected evaluateConfidence(result: string): number {
    // Simple heuristic - can be overridden
    const length = result.length
    const hasStructure = /```|###|##|1\.|2\.|3\./.test(result)
    const hasDetails = length > 200

    let confidence = 0.5

    if (hasStructure) confidence += 0.2
    if (hasDetails) confidence += 0.2
    if (length > 500) confidence += 0.1

    return Math.min(confidence, 1.0)
  }
}
