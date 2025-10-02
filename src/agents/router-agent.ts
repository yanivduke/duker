/**
 * Router Agent - Central orchestrator
 */

import {
  TaskInput,
  TaskAnalysis,
  AgentResponse,
  AgenticPattern,
  MCPTool,
} from '../types/index.js'
import { LLMManager } from '../llm/index.js'
import { PermissionManager } from '../security/index.js'

export class RouterAgent {
  private llmManager: LLMManager
  private permissionManager: PermissionManager
  private tools: Map<string, MCPTool> = new Map()

  constructor(llmManager: LLMManager, permissionManager: PermissionManager) {
    this.llmManager = llmManager
    this.permissionManager = permissionManager
  }

  /**
   * Register a tool
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Main routing function
   */
  async route(input: TaskInput): Promise<AgentResponse> {
    try {
      // 1. Analyze task
      const analysis = await this.analyzeTask(input)

      // 2. Select pattern and model
      const pattern = this.selectPattern(analysis)
      const modelSelection = this.llmManager.selectModel(analysis)

      // 3. Execute based on pattern
      return await this.execute(input, pattern, modelSelection.model)
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
   * Analyze task to determine complexity and requirements
   */
  private async analyzeTask(input: TaskInput): Promise<TaskAnalysis> {
    // Simple heuristic-based analysis for now
    // In production, this would use an LLM to analyze the task

    const taskLower = input.task.toLowerCase()

    // Determine if tools are needed
    const requiresTools =
      taskLower.includes('run') ||
      taskLower.includes('execute') ||
      taskLower.includes('file') ||
      taskLower.includes('read') ||
      taskLower.includes('write')

    // Determine complexity
    let complexity: TaskAnalysis['complexity'] = 'simple'
    if (taskLower.includes('complex') || taskLower.includes('design')) {
      complexity = 'complex'
    } else if (taskLower.includes('analyze') || taskLower.includes('debug')) {
      complexity = 'moderate'
    }

    // Determine type
    let type: TaskAnalysis['type'] = 'code-generation'
    if (taskLower.includes('analyze')) type = 'code-analysis'
    if (taskLower.includes('debug')) type = 'debugging'
    if (taskLower.includes('refactor')) type = 'refactoring'
    if (taskLower.includes('document')) type = 'documentation'

    return {
      complexity,
      type,
      requiresTools,
      requiresReasoning: complexity !== 'simple',
      requiresMultiModal: false,
      contextSize: input.task.length,
      estimatedSteps: requiresTools ? 3 : 1,
    }
  }

  /**
   * Select appropriate pattern based on analysis
   */
  private selectPattern(analysis: TaskAnalysis): AgenticPattern {
    if (analysis.requiresTools) {
      return 'tool-use'
    }

    if (analysis.complexity === 'complex') {
      return 'planning'
    }

    if (analysis.requiresReasoning && analysis.complexity === 'moderate') {
      return 'reflection'
    }

    return 'direct'
  }

  /**
   * Execute task using selected pattern
   */
  private async execute(
    input: TaskInput,
    pattern: AgenticPattern,
    model: string
  ): Promise<AgentResponse> {
    const startTime = Date.now()

    switch (pattern) {
      case 'direct':
        return await this.executeDirect(input, model)

      case 'tool-use':
        return await this.executeWithTools(input, model)

      default:
        // For now, fallback to direct execution
        return await this.executeDirect(input, model)
    }
  }

  /**
   * Direct LLM execution
   */
  private async executeDirect(
    input: TaskInput,
    model: string
  ): Promise<AgentResponse> {
    const startTime = Date.now()

    const response = await this.llmManager.generate({
      messages: [
        {
          role: 'system',
          content:
            'You are Duker, an AI coding assistant. Provide clear, concise, and helpful responses.',
        },
        {
          role: 'user',
          content: input.task,
        },
      ],
      model,
    })

    return {
      success: true,
      output: response.text,
      metadata: {
        agent: 'router',
        pattern: 'direct',
        tokensUsed: response.usage.totalTokens,
        duration: Date.now() - startTime,
      },
    }
  }

  /**
   * Execute with tools
   */
  private async executeWithTools(
    input: TaskInput,
    model: string
  ): Promise<AgentResponse> {
    const startTime = Date.now()

    // For now, simple execution with available tools
    // In production, this would use tool calling with the LLM

    const response = await this.llmManager.generate({
      messages: [
        {
          role: 'system',
          content: `You are Duker, an AI coding assistant with access to tools.
Available tools: ${Array.from(this.tools.keys()).join(', ')}

Provide clear, actionable responses.`,
        },
        {
          role: 'user',
          content: input.task,
        },
      ],
      model,
    })

    return {
      success: true,
      output: response.text,
      metadata: {
        agent: 'router',
        pattern: 'tool-use',
        tokensUsed: response.usage.totalTokens,
        toolsUsed: Array.from(this.tools.keys()),
        duration: Date.now() - startTime,
      },
    }
  }
}
