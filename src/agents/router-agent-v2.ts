/**
 * Router Agent V2 - Enhanced with all agentic patterns
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
import { ReflectionAgent } from './reflection-agent.js'
import { ToolUseAgent } from './tool-use-agent.js'
import { PlanningAgent } from './planning-agent.js'

export class RouterAgentV2 {
  private llmManager: LLMManager
  private permissionManager: PermissionManager
  private tools: Map<string, MCPTool> = new Map()

  // Specialized agents
  private reflectionAgent: ReflectionAgent
  private toolUseAgent: ToolUseAgent
  private planningAgent: PlanningAgent
  private apiKey: string

  constructor(
    llmManager: LLMManager,
    permissionManager: PermissionManager,
    apiKey: string
  ) {
    this.llmManager = llmManager
    this.permissionManager = permissionManager
    this.apiKey = apiKey

    // Initialize specialized agents
    this.reflectionAgent = new ReflectionAgent(llmManager)
    this.toolUseAgent = new ToolUseAgent(llmManager, apiKey)
    this.planningAgent = new PlanningAgent(llmManager)
  }

  /**
   * Register a tool
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool)
    this.toolUseAgent.registerTool(tool)
    this.planningAgent.registerTool(tool)
  }

  /**
   * Main routing function
   */
  async route(input: TaskInput): Promise<AgentResponse> {
    try {
      console.log('[Router] Analyzing task...')

      // 1. Analyze task
      const analysis = await this.analyzeTask(input)

      console.log(`[Router] Complexity: ${analysis.complexity}`)
      console.log(`[Router] Type: ${analysis.type}`)

      // 2. Select pattern
      const pattern = this.selectPattern(analysis)
      console.log(`[Router] Selected pattern: ${pattern}`)

      // 3. Select model
      const modelSelection = this.llmManager.selectModel(analysis)
      console.log(`[Router] Selected model: ${modelSelection.model}`)
      console.log(`[Router] Reasoning: ${modelSelection.reasoning}`)

      // 4. Execute based on pattern
      return await this.execute(input, pattern, analysis)
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
    const taskLower = input.task.toLowerCase()

    // Determine if tools are needed
    const requiresTools =
      taskLower.includes('run') ||
      taskLower.includes('execute') ||
      taskLower.includes('file') ||
      taskLower.includes('read') ||
      taskLower.includes('write') ||
      taskLower.includes('search') ||
      taskLower.includes('find')

    // Determine complexity
    let complexity: TaskAnalysis['complexity'] = 'simple'

    if (
      taskLower.includes('complex') ||
      taskLower.includes('system') ||
      taskLower.includes('architecture')
    ) {
      complexity = 'complex'
    } else if (
      taskLower.includes('analyze') ||
      taskLower.includes('debug') ||
      taskLower.includes('optimize') ||
      taskLower.includes('improve')
    ) {
      complexity = 'moderate'
    }

    // Check for multi-step indicators
    const isMultiStep =
      taskLower.includes('and') ||
      taskLower.includes('then') ||
      taskLower.includes('also') ||
      taskLower.includes('feature')

    if (isMultiStep) {
      complexity = complexity === 'simple' ? 'moderate' : 'complex'
    }

    // Determine type
    let type: TaskAnalysis['type'] = 'code-generation'

    if (taskLower.includes('analyze')) type = 'code-analysis'
    if (taskLower.includes('debug')) type = 'debugging'
    if (taskLower.includes('refactor')) type = 'refactoring'
    if (taskLower.includes('document')) type = 'documentation'
    if (taskLower.includes('search') || taskLower.includes('find') || taskLower.includes('how'))
      type = 'research'
    if (isMultiStep) type = 'multi-step'

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
    // Complex multi-step tasks → Planning
    if (analysis.complexity === 'complex' || analysis.type === 'multi-step') {
      return 'planning'
    }

    // Tasks requiring tools → Tool Use
    if (analysis.requiresTools) {
      return 'tool-use'
    }

    // Quality-critical tasks → Reflection
    if (
      analysis.type === 'code-generation' &&
      analysis.complexity === 'moderate'
    ) {
      return 'reflection'
    }

    // Simple tasks → Direct
    return 'direct'
  }

  /**
   * Execute task using selected pattern
   */
  private async execute(
    input: TaskInput,
    pattern: AgenticPattern,
    analysis: TaskAnalysis
  ): Promise<AgentResponse> {
    switch (pattern) {
      case 'reflection':
        return await this.reflectionAgent.execute(input)

      case 'tool-use':
        return await this.toolUseAgent.execute(input)

      case 'planning':
        return await this.planningAgent.execute(input)

      case 'direct':
      default:
        return await this.executeDirect(input, analysis)
    }
  }

  /**
   * Direct LLM execution
   */
  private async executeDirect(
    input: TaskInput,
    analysis: TaskAnalysis
  ): Promise<AgentResponse> {
    const startTime = Date.now()
    const modelSelection = this.llmManager.selectModel(analysis)

    const response = await this.llmManager.generate({
      messages: [
        {
          role: 'system',
          content: `You are Duker, an AI coding assistant.
Provide clear, concise, and helpful responses.
When writing code, follow best practices and include comments.`,
        },
        {
          role: 'user',
          content: input.task,
        },
      ],
      model: modelSelection.model,
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
   * Get available patterns
   */
  getAvailablePatterns(): AgenticPattern[] {
    return ['direct', 'reflection', 'tool-use', 'planning']
  }
}
