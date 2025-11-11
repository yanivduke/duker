/**
 * LLM Manager
 * Manages multiple LLM providers and handles requests
 */

import {
  LLMProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  TaskAnalysis,
  LLMError,
} from '../types/index.js'
import { AnthropicProvider, ExtendedThinkingConfig } from './providers/anthropic-provider.js'

export interface ModelSelection {
  provider: string
  model: string
  reasoning: string
}

export class LLMManager {
  private providers: Map<string, LLMProvider> = new Map()
  private defaultProvider: string
  private extendedThinkingConfig?: ExtendedThinkingConfig

  constructor(defaultProvider = 'anthropic') {
    this.defaultProvider = defaultProvider
  }

  /**
   * Enable extended thinking mode for Anthropic provider
   */
  enableExtendedThinking(config: Partial<ExtendedThinkingConfig>): void {
    this.extendedThinkingConfig = {
      enabled: true,
      maxThinkingTokens: config.maxThinkingTokens,
      thinkingBudget: config.thinkingBudget,
    }

    // Apply to existing Anthropic provider if registered
    const anthropicProvider = this.providers.get('anthropic') as AnthropicProvider | undefined
    if (anthropicProvider && anthropicProvider.enableExtendedThinking) {
      anthropicProvider.enableExtendedThinking(config)
    }
  }

  /**
   * Disable extended thinking mode
   */
  disableExtendedThinking(): void {
    this.extendedThinkingConfig = undefined

    const anthropicProvider = this.providers.get('anthropic') as AnthropicProvider | undefined
    if (anthropicProvider && anthropicProvider.disableExtendedThinking) {
      anthropicProvider.disableExtendedThinking()
    }
  }

  /**
   * Register an LLM provider
   */
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider)
  }

  /**
   * Get a specific provider
   */
  getProvider(name?: string): LLMProvider {
    const providerName = name || this.defaultProvider
    const provider = this.providers.get(providerName)

    if (!provider) {
      throw new LLMError(`Provider ${providerName} not found`, providerName)
    }

    return provider
  }

  /**
   * Generate text using specified provider
   */
  async generate(
    request: GenerateRequest,
    provider?: string
  ): Promise<GenerateResponse> {
    return await this.generateWithRetry(request, provider)
  }

  /**
   * Stream text using specified provider
   */
  async *stream(
    request: GenerateRequest,
    provider?: string
  ): AsyncIterable<StreamChunk> {
    const llmProvider = this.getProvider(provider)
    yield* llmProvider.stream(request)
  }

  /**
   * Select optimal provider and model based on task analysis
   */
  selectModel(analysis: TaskAnalysis): ModelSelection {
    // Complex reasoning → Claude Opus
    if (
      analysis.complexity === 'very-complex' &&
      analysis.requiresReasoning
    ) {
      return {
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        reasoning: 'Complex reasoning requires Claude Opus capabilities',
      }
    }

    // Long context → Claude Sonnet
    if (analysis.contextSize > 100000) {
      return {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Large context best handled by Claude Sonnet',
      }
    }

    // Tool use required → Claude Sonnet
    if (analysis.requiresTools) {
      return {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Superior tool use capabilities with Claude Sonnet',
      }
    }

    // Simple tasks → Claude Haiku (faster, cheaper)
    if (analysis.complexity === 'simple') {
      return {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        reasoning: 'Simple task suited for fast, efficient Claude Haiku',
      }
    }

    // Default → Claude Sonnet (balanced)
    return {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      reasoning: 'Balanced performance for general tasks',
    }
  }

  /**
   * Generate with automatic retry and fallback
   */
  private async generateWithRetry(
    request: GenerateRequest,
    provider?: string,
    maxAttempts = 3
  ): Promise<GenerateResponse> {
    let lastError: Error | null = null
    let currentProvider = provider || this.defaultProvider

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const llmProvider = this.getProvider(currentProvider)
        return await llmProvider.generate(request)
      } catch (error) {
        lastError = error as Error

        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          // Exponential backoff
          const delay = 1000 * Math.pow(2, attempt)
          await this.delay(delay)
          continue
        }

        // Try fallback provider
        if (this.isProviderError(error) && attempt < maxAttempts) {
          currentProvider = this.selectFallbackProvider(currentProvider)
          console.warn(
            `Provider error, falling back to ${currentProvider}`
          )
          continue
        }

        // Unrecoverable error
        throw error
      }
    }

    throw lastError!
  }

  /**
   * Select fallback provider
   */
  private selectFallbackProvider(current: string): string {
    const fallbackChain: Record<string, string> = {
      anthropic: 'openai',
      openai: 'google',
      google: 'anthropic',
    }

    return fallbackChain[current] || this.defaultProvider
  }

  /**
   * Check if error is rate limit
   */
  private isRateLimitError(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.code === 'rate_limit_exceeded' ||
      error?.message?.includes('rate limit')
    )
  }

  /**
   * Check if error is provider-level
   */
  private isProviderError(error: any): boolean {
    return (
      error?.status >= 500 ||
      error?.code === 'service_unavailable' ||
      error?.message?.includes('service unavailable')
    )
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get all registered providers
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys())
  }
}
