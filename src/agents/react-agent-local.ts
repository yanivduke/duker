/**
 * ReAct Agent for Local LLMs
 * Optimized for small models with simpler prompts and more iterations
 */

import { LLMManager } from '../llm/llm-manager.js'
import { MCPTool, TaskInput, AgentResponse, Message } from '../types/index.js'
import { KnowledgeLoader } from '../utils/knowledge-loader.js'

export interface ReActStep {
  step: number
  thought: string
  action: string | null
  actionInput: any | null
  observation: string | null
  complete: boolean
}

export interface ReActConfig {
  maxSteps?: number
  useKnowledge?: boolean
  knowledgeCollections?: string[]
  temperature?: number
}

/**
 * ReAct Agent optimized for local LLMs
 * Uses simple, direct prompts and iterative refinement
 */
export class ReActAgentLocal {
  private llm: LLMManager
  private tools: Map<string, MCPTool> = new Map()
  private knowledge: KnowledgeLoader
  private history: ReActStep[] = []

  constructor(llm: LLMManager) {
    this.llm = llm
    this.knowledge = new KnowledgeLoader()
  }

  /**
   * Register a tool
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Execute task using ReAct pattern
   */
  async execute(
    input: TaskInput,
    config: ReActConfig = {}
  ): Promise<AgentResponse> {
    const {
      maxSteps = 5,
      useKnowledge = true,
      knowledgeCollections = ['duker-vue3-vuetify3', 'duker-best-practices'],
      temperature = 0.2,
    } = config

    this.history = []
    let step = 1
    let complete = false
    let finalAnswer = ''

    // Get knowledge context if requested
    let knowledgeContext = ''
    if (useKnowledge) {
      for (const collection of knowledgeCollections) {
        const result = await this.knowledge.search(input.task, collection, 2)
        if (result.context) {
          knowledgeContext += `\n\n${collection}:\n${result.context}`
        }
      }
    }

    while (step <= maxSteps && !complete) {
      // Simple, direct prompt for local models
      const stepResult = await this.executeStep(
        input.task,
        knowledgeContext,
        step,
        temperature
      )

      this.history.push(stepResult)

      if (stepResult.complete) {
        complete = true
        finalAnswer = stepResult.observation || stepResult.thought
      }

      step++
    }

    return {
      result: finalAnswer || 'Task incomplete - max steps reached',
      metadata: {
        pattern: 'react-local',
        steps: this.history.length,
        complete,
        toolsUsed: this.history.filter((h) => h.action).map((h) => h.action!),
      },
    }
  }

  /**
   * Execute a single ReAct step
   */
  private async executeStep(
    task: string,
    knowledgeContext: string,
    stepNumber: number,
    temperature: number
  ): Promise<ReActStep> {
    // Build simple, structured prompt
    const prompt = this.buildSimplePrompt(task, knowledgeContext, stepNumber)

    // Get LLM response
    const response = await this.llm.generate(
      {
        messages: [{ role: 'user', content: prompt }],
        temperature,
        maxTokens: 512, // Keep responses concise for local models
      },
      'ollama' // Prefer local Ollama
    )

    // Parse response
    return this.parseResponse(response.text, stepNumber)
  }

  /**
   * Build simple, structured prompt for local models
   */
  private buildSimplePrompt(
    task: string,
    knowledgeContext: string,
    stepNumber: number
  ): string {
    const availableTools = Array.from(this.tools.values())
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n')

    const previousSteps = this.history
      .map(
        (h) =>
          `Step ${h.step}:\nThought: ${h.thought}\n${h.action ? `Action: ${h.action}\nResult: ${h.observation}` : ''}`
      )
      .join('\n\n')

    // SIMPLE prompt optimized for local models
    return `Task: ${task}

${knowledgeContext ? `Knowledge:\n${knowledgeContext}\n` : ''}
${previousSteps ? `Previous Steps:\n${previousSteps}\n` : ''}
Available Tools:
${availableTools}

You are Step ${stepNumber}. Think about what to do next.

Response format:
THOUGHT: [your reasoning]
ACTION: [tool name or COMPLETE]
INPUT: [tool input or final answer]

Your response:`
  }

  /**
   * Parse LLM response into structured step
   */
  private parseResponse(text: string, stepNumber: number): ReActStep {
    const thought = this.extractField(text, 'THOUGHT')
    const action = this.extractField(text, 'ACTION')
    const input = this.extractField(text, 'INPUT')

    const step: ReActStep = {
      step: stepNumber,
      thought: thought || 'Continue working on task',
      action: null,
      actionInput: null,
      observation: null,
      complete: false,
    }

    // Check if complete
    if (action?.toUpperCase() === 'COMPLETE' || action?.toUpperCase() === 'DONE') {
      step.complete = true
      step.observation = input || thought
      return step
    }

    // Execute action if valid tool
    if (action && this.tools.has(action)) {
      step.action = action
      step.actionInput = this.parseInput(input || '{}')
      step.observation = this.executeToolSync(action, step.actionInput)
    }

    return step
  }

  /**
   * Extract field from response
   */
  private extractField(text: string, field: string): string {
    const regex = new RegExp(`${field}:\\s*(.+?)(?=\\n[A-Z]+:|$)`, 's')
    const match = text.match(regex)
    return match ? match[1].trim() : ''
  }

  /**
   * Parse input string to object
   */
  private parseInput(input: string): any {
    try {
      // Try JSON parse first
      return JSON.parse(input)
    } catch {
      // If not JSON, return as object with text field
      return { text: input }
    }
  }

  /**
   * Execute tool synchronously (simplified)
   */
  private executeToolSync(toolName: string, input: any): string {
    const tool = this.tools.get(toolName)
    if (!tool) return 'Tool not found'

    try {
      // This is synchronous for simplicity - in production use async
      const result = (tool.execute(input) as any).then
        ? '[Async execution started]'
        : JSON.stringify((tool as any).execute(input))

      return result
    } catch (error: any) {
      return `Error: ${error.message}`
    }
  }

  /**
   * Get execution history
   */
  getHistory(): ReActStep[] {
    return this.history
  }

  /**
   * Format history for display
   */
  formatHistory(): string {
    return this.history
      .map(
        (h) =>
          `--- Step ${h.step} ---\n` +
          `Thought: ${h.thought}\n` +
          (h.action ? `Action: ${h.action}(${JSON.stringify(h.actionInput)})\n` : '') +
          (h.observation ? `Observation: ${h.observation}\n` : '') +
          (h.complete ? '✓ COMPLETE\n' : '')
      )
      .join('\n')
  }
}

/**
 * Simple ReAct executor for quick tasks
 */
export async function runReActLocal(
  llm: LLMManager,
  task: string,
  tools: MCPTool[] = [],
  config: ReActConfig = {}
): Promise<string> {
  const agent = new ReActAgentLocal(llm)

  // Register tools
  tools.forEach((tool) => agent.registerTool(tool))

  const response = await agent.execute({ task }, config)

  return response.result
}
