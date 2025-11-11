/**
 * Anthropic Claude Provider with Extended Thinking Support
 * Supports Claude's extended thinking mode for complex reasoning tasks
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText } from 'ai'
import {
  LLMProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  ModelConfig,
} from '../../types/index.js'

export interface ExtendedThinkingConfig {
  enabled: boolean
  maxThinkingTokens?: number
  thinkingBudget?: number
}

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic'

  models: ModelConfig[] = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      strengths: ['reasoning', 'long-context', 'tool-use', 'code-generation'],
    },
    {
      id: 'claude-3-7-sonnet-20250219',
      name: 'Claude 3.7 Sonnet (Extended Thinking)',
      contextWindow: 200000,
      strengths: ['extended-reasoning', 'complex-problem-solving', 'multi-step-planning', 'code-generation'],
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      contextWindow: 200000,
      strengths: ['complex-reasoning', 'analysis', 'creative-tasks'],
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      contextWindow: 200000,
      strengths: ['speed', 'cost-effective', 'simple-tasks'],
    },
  ]

  private apiKey: string
  private defaultModel: string
  private extendedThinking: ExtendedThinkingConfig

  constructor(
    apiKey: string,
    defaultModel = 'claude-3-5-sonnet-20241022',
    extendedThinking: ExtendedThinkingConfig = { enabled: false }
  ) {
    this.apiKey = apiKey
    this.defaultModel = defaultModel
    this.extendedThinking = extendedThinking
  }

  /**
   * Enable extended thinking mode
   */
  enableExtendedThinking(config: Partial<ExtendedThinkingConfig> = {}): void {
    this.extendedThinking = {
      enabled: true,
      maxThinkingTokens: config.maxThinkingTokens ?? 10000,
      thinkingBudget: config.thinkingBudget ?? 5000,
    }
  }

  /**
   * Disable extended thinking mode
   */
  disableExtendedThinking(): void {
    this.extendedThinking = { enabled: false }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const anthropic = createAnthropic({ apiKey: this.apiKey })
    const modelId = request.model || this.defaultModel
    const model = anthropic(modelId)

    // Prepare generation config
    const config: any = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 4096,
      topP: request.topP,
    }

    // Add extended thinking support for compatible models
    if (this.extendedThinking.enabled && this.supportsExtendedThinking(modelId)) {
      config.experimental_thinking = {
        type: 'enabled',
        budget_tokens: this.extendedThinking.thinkingBudget,
      }

      // Increase max tokens to account for thinking
      config.maxOutputTokens = (request.maxTokens ?? 4096) + (this.extendedThinking.maxThinkingTokens ?? 10000)
    }

    const result = await generateText(config)

    // Extract thinking blocks if present
    const thinkingBlocks = this.extractThinkingBlocks(result)

    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      },
      finishReason: this.mapFinishReason(result.finishReason),
      metadata: {
        thinkingBlocks,
        extendedThinking: this.extendedThinking.enabled,
      },
    }
  }

  /**
   * Check if model supports extended thinking
   */
  private supportsExtendedThinking(modelId: string): boolean {
    // Extended thinking is supported on Claude 3.7+ and specific Claude 3.5 versions
    return (
      modelId.includes('claude-3-7') ||
      modelId.includes('claude-3-5-sonnet-20241022') ||
      modelId.includes('claude-sonnet-4')
    )
  }

  /**
   * Extract thinking blocks from response
   */
  private extractThinkingBlocks(result: any): Array<{ content: string; type: string }> {
    const blocks: Array<{ content: string; type: string }> = []

    if (result.experimental_thinking) {
      blocks.push({
        type: 'thinking',
        content: result.experimental_thinking,
      })
    }

    return blocks
  }

  async *stream(request: GenerateRequest): AsyncIterable<StreamChunk> {
    const anthropic = createAnthropic({ apiKey: this.apiKey })
    const modelId = request.model || this.defaultModel
    const model = anthropic(modelId)

    // Prepare stream config
    const config: any = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 4096,
    }

    // Add extended thinking support for compatible models
    if (this.extendedThinking.enabled && this.supportsExtendedThinking(modelId)) {
      config.experimental_thinking = {
        type: 'enabled',
        budget_tokens: this.extendedThinking.thinkingBudget,
      }

      // Increase max tokens to account for thinking
      config.maxOutputTokens = (request.maxTokens ?? 4096) + (this.extendedThinking.maxThinkingTokens ?? 10000)
    }

    const result = streamText(config)

    for await (const chunk of result.textStream) {
      yield { content: chunk, done: false }
    }

    yield { content: '', done: true }
  }

  private mapFinishReason(reason: string): 'stop' | 'length' | 'content-filter' | 'error' {
    switch (reason) {
      case 'end_turn':
      case 'stop':
        return 'stop'
      case 'max_tokens':
      case 'length':
        return 'length'
      case 'content_filter':
        return 'content-filter'
      default:
        return 'error'
    }
  }
}
