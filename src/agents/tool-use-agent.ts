/**
 * Tool Use Agent - Enhanced with Vercel AI SDK function calling
 * Enables LLMs to intelligently use tools
 */

import { generateText, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { AgentResponse, TaskInput, MCPTool } from '../types/index.js'
import { LLMManager } from '../llm/index.js'

export interface ToolUseConfig {
  maxSteps: number
  model?: string
  temperature?: number
}

export class ToolUseAgent {
  private llmManager: LLMManager
  private config: ToolUseConfig
  private tools: Map<string, MCPTool> = new Map()
  private apiKey: string

  constructor(
    llmManager: LLMManager,
    apiKey: string,
    config?: Partial<ToolUseConfig>
  ) {
    this.llmManager = llmManager
    this.apiKey = apiKey
    this.config = {
      maxSteps: config?.maxSteps ?? 5,
      model: config?.model ?? 'claude-3-5-sonnet-20241022',
      temperature: config?.temperature ?? 0.7,
    }
  }

  /**
   * Register a tool
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Execute task with tool use
   */
  async execute(input: TaskInput): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      // Convert MCP tools to AI SDK tool format
      const aiTools = this.convertToAITools()

      const anthropic = createAnthropic({ apiKey: this.apiKey })
      const model = anthropic(this.config.model!)

      // Use AI SDK's generateText with tools
      const result = await generateText({
        model,
        system: `You are Duker, a coding assistant with access to tools.
Available tools: ${Array.from(this.tools.keys()).join(', ')}

Use tools when needed to:
- Execute commands (shell tool)
- Read/write files (context tool)
- Search for information (web-search tool)

Be precise and efficient in your tool use.`,
        prompt: input.task,
        tools: aiTools,
        stopWhen: stepCountIs(this.config.maxSteps),
        temperature: this.config.temperature,
      })

      // Extract tool calls info from all steps
      const toolsUsed = result.toolCalls?.map((tc) => tc.toolName) || []

      return {
        success: true,
        output: result.text,
        metadata: {
          agent: 'tool-use',
          pattern: 'tool-use',
          toolsUsed: [...new Set(toolsUsed)],
          tokensUsed: result.usage.totalTokens,
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
   * Convert MCP tools to AI SDK tool format
   */
  private convertToAITools(): Record<string, any> {
    const aiTools: Record<string, any> = {}

    for (const [name, tool] of this.tools) {
      // Create Zod schema from tool schema
      const zodSchema = this.createZodSchema(tool)

      aiTools[name] = {
        description: tool.description,
        parameters: zodSchema,
        execute: async (params: any) => {
          try {
            const result = await tool.execute(params)
            return result.success ? result.data : { error: result.error }
          } catch (error: any) {
            // Handle permission denied gracefully
            if (error.name === 'PermissionDeniedError') {
              return { error: 'Permission denied by user', cancelled: true }
            }
            throw error
          }
        },
      }
    }

    return aiTools
  }

  /**
   * Create Zod schema from tool schema
   */
  private createZodSchema(tool: MCPTool): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {}

    // Support both 'parameters' and 'properties' (JSON Schema format)
    const params = tool.schema.parameters || tool.schema.properties || {}

    for (const [paramName, paramDef] of Object.entries(params)) {
      let zodType: z.ZodTypeAny

      switch (paramDef.type) {
        case 'string':
          zodType = z.string().describe(paramDef.description)
          break
        case 'number':
          zodType = z.number().describe(paramDef.description)
          break
        case 'boolean':
          zodType = z.boolean().describe(paramDef.description)
          break
        default:
          zodType = z.any().describe(paramDef.description)
      }

      if (paramDef.optional) {
        zodType = zodType.optional()
      }

      shape[paramName] = zodType
    }

    return z.object(shape)
  }

  /**
   * Execute with streaming (for future UI integration)
   */
  async *executeStream(input: TaskInput): AsyncIterable<string> {
    // This would use streamText from AI SDK
    // For now, we'll implement in next phase
    yield* this.executeStreamInternal(input)
  }

  private async *executeStreamInternal(input: TaskInput): AsyncIterable<string> {
    const response = await this.execute(input)
    yield response.output
  }
}
