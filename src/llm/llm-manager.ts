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
   * Includes Ollama local LLM support with iteration strategies
   */
  selectModel(analysis: TaskAnalysis, preferLocal = false): ModelSelection {
    // If Ollama is available and preferred, use local models with iteration strategy
    if (preferLocal && this.providers.has('ollama')) {
      return this.selectLocalModel(analysis)
    }

    // Complex reasoning → Claude Opus or Phind CodeLlama (local alternative)
    if (
      analysis.complexity === 'very-complex' &&
      analysis.requiresReasoning
    ) {
      if (preferLocal && this.providers.has('ollama')) {
        return {
          provider: 'ollama',
          model: 'phind-codellama:34b',
          reasoning: 'Complex reasoning with local model + multi-iteration strategy',
        }
      }
      return {
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        reasoning: 'Complex reasoning requires Claude Opus capabilities',
      }
    }

    // Long context → Claude Sonnet or Qwen Coder (local)
    if (analysis.contextSize > 100000) {
      return {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Large context best handled by Claude Sonnet',
      }
    }

    // Code generation → Local CodeLlama or DeepSeek Coder
    if (analysis.type === 'code-generation' && preferLocal) {
      return {
        provider: 'ollama',
        model: 'deepseek-coder:6.7b',
        reasoning: 'Code generation with local model + reflection cycles',
      }
    }

    // Tool use required → Claude Sonnet or CodeLlama (local)
    if (analysis.requiresTools) {
      if (preferLocal && this.providers.has('ollama')) {
        return {
          provider: 'ollama',
          model: 'codellama:13b',
          reasoning: 'Tool use with local model + iterative refinement',
        }
      }
      return {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Superior tool use capabilities with Claude Sonnet',
      }
    }

    // Simple tasks → Local small model or Claude Haiku
    if (analysis.complexity === 'simple') {
      if (preferLocal && this.providers.has('ollama')) {
        return {
          provider: 'ollama',
          model: 'codellama:7b',
          reasoning: 'Simple task with fast local model',
        }
      }
      return {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        reasoning: 'Simple task suited for fast, efficient Claude Haiku',
      }
    }

    // Default → Claude Sonnet or CodeLlama (balanced)
    if (preferLocal && this.providers.has('ollama')) {
      return {
        provider: 'ollama',
        model: 'codellama:13b',
        reasoning: 'Balanced local model with iteration strategy',
      }
    }

    return {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      reasoning: 'Balanced performance for general tasks',
    }
  }

  /**
   * Select optimal local Ollama model
   */
  private selectLocalModel(analysis: TaskAnalysis): ModelSelection {
    // Code-specific tasks → CodeLlama or DeepSeek
    if (
      analysis.type === 'code-generation' ||
      analysis.type === 'code-analysis' ||
      analysis.type === 'debugging'
    ) {
      if (analysis.complexity === 'very-complex') {
        return {
          provider: 'ollama',
          model: 'phind-codellama:34b',
          reasoning: 'Complex coding with large local model + iterations',
        }
      }
      return {
        provider: 'ollama',
        model: 'deepseek-coder:6.7b',
        reasoning: 'Code tasks with specialized local model',
      }
    }

    // General tasks → Mistral or Llama2
    if (analysis.complexity === 'simple') {
      return {
        provider: 'ollama',
        model: 'mistral:7b',
        reasoning: 'Fast local model for simple tasks',
      }
    }

    // Default → CodeLlama 13B (good balance)
    return {
      provider: 'ollama',
      model: 'codellama:13b',
      reasoning: 'Balanced local model with iteration support',
    }
  }

  /**
   * Get recommended iteration count for model
   * Small local models benefit from more iterations
   */
  getRecommendedIterations(provider: string, model: string): number {
    if (provider === 'ollama') {
      // Larger models need fewer iterations
      if (model.includes('34b')) return 3
      if (model.includes('13b')) return 5
      if (model.includes('7b')) return 7
      return 5
    }

    // Cloud models are more capable, need fewer iterations
    if (provider === 'anthropic') {
      if (model.includes('opus')) return 2
      if (model.includes('sonnet')) return 3
      if (model.includes('haiku')) return 4
    }

    return 3 // Default
  }

  /**
   * Get recommended temperature for task type
   */
  getRecommendedTemperature(taskType: string): number {
    const temperatureMap: Record<string, number> = {
      'code-generation': 0.2,
      'code-analysis': 0.3,
      'debugging': 0.1,
      'refactoring': 0.2,
      'documentation': 0.4,
      'research': 0.5,
      'multi-step': 0.3,
    }
    return temperatureMap[taskType] ?? 0.3
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
      google: 'ollama',
      ollama: 'anthropic', // Fallback to cloud if local fails
    }

    const fallback = fallbackChain[current]
    return this.providers.has(fallback) ? fallback : this.defaultProvider
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
