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
import { ReflectionAgentV2 } from './reflection-agent-v2.js'
import { ToolUseAgent } from './tool-use-agent.js'
import { PlanningAgent } from './planning-agent.js'
import { MultiAgentCoordinator } from './multi-agent/index.js'

export class RouterAgentV2 {
  private llmManager: LLMManager
  private permissionManager: PermissionManager
  private tools: Map<string, MCPTool> = new Map()

  // Specialized agents
  private reflectionAgent: ReflectionAgent
  private reflectionAgentV2: ReflectionAgentV2
  private toolUseAgent: ToolUseAgent
  private planningAgent: PlanningAgent
  private multiAgentCoordinator: MultiAgentCoordinator
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
    this.reflectionAgentV2 = new ReflectionAgentV2(llmManager, {
      strictMode: true,
      generateTests: true,
      generateDocs: true,
      qualityThreshold: 0.90,
    })
    this.toolUseAgent = new ToolUseAgent(llmManager, apiKey)
    this.planningAgent = new PlanningAgent(llmManager)
    this.multiAgentCoordinator = new MultiAgentCoordinator(llmManager)
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
    // Multi-specialist tasks → Multi-Agent
    // Use when task requires multiple perspectives (security, performance, testing)
    if (
      analysis.complexity === 'complex' &&
      (analysis.type === 'code-analysis' ||
        analysis.type === 'code-generation' ||
        /review|audit|analyze multiple|comprehensive/.test(analysis.toString()))
    ) {
      return 'multi-agent'
    }

    // Complex multi-step tasks → Planning
    if (analysis.complexity === 'complex' || analysis.type === 'multi-step') {
      return 'planning'
    }

    // Tasks requiring tools → Tool Use
    if (analysis.requiresTools) {
      return 'tool-use'
    }

    // Production code generation → Reflection V2
    // Use advanced reflection for any code generation task
    if (
      analysis.type === 'code-generation' ||
      analysis.type === 'refactoring' ||
      analysis.type === 'debugging'
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
      case 'multi-agent':
        console.log('[Router] Using Multi-Agent Coordination')
        return await this.multiAgentCoordinator.execute(input)

      case 'reflection':
        // Use V2 for code-related tasks, V1 for others
        if (
          analysis.type === 'code-generation' ||
          analysis.type === 'refactoring' ||
          analysis.type === 'debugging'
        ) {
          console.log('[Router] Using Reflection V2 (Advanced Code Generation)')
          return await this.reflectionAgentV2.execute(input)
        }
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
    return ['direct', 'reflection', 'tool-use', 'planning', 'multi-agent']
  }

  /**
   * Set iteration manager for multi-agent coordinator
   */
  setIterationManager(iterationManager: any): void {
    this.multiAgentCoordinator.setIterationManager(iterationManager)
  }
}
