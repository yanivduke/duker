/**
 * Model-Specific Configuration
 * Optimized settings for different LLM providers and model sizes
 */

export interface ModelStrategy {
  provider: string
  model: string

  // Iteration strategy
  maxIterations: number
  iterationsPerCycle: number
  reflectionCycles: number

  // Generation parameters
  temperature: number
  maxTokens: number
  topP: number

  // Prompting strategy
  promptStyle: 'detailed' | 'concise' | 'structured'
  useChainOfThought: boolean
  useKnowledge: boolean
  knowledgeChunkSize: number

  // Performance
  batchSize: number
  parallelTasks: number
  timeoutMs: number

  // Quality thresholds
  qualityThreshold: number
  minimumProgress: number
  stallThreshold: number
}

export const MODEL_STRATEGIES: Record<string, ModelStrategy> = {
  // Local Models (Ollama)
  'ollama:codellama:7b': {
    provider: 'ollama',
    model: 'codellama:7b',
    maxIterations: 7,
    iterationsPerCycle: 3,
    reflectionCycles: 2,
    temperature: 0.2,
    maxTokens: 1024,
    topP: 0.9,
    promptStyle: 'structured',
    useChainOfThought: true,
    useKnowledge: true,
    knowledgeChunkSize: 400,
    batchSize: 1,
    parallelTasks: 1,
    timeoutMs: 30000,
    qualityThreshold: 0.75,
    minimumProgress: 0.1,
    stallThreshold: 3,
  },

  'ollama:codellama:13b': {
    provider: 'ollama',
    model: 'codellama:13b',
    maxIterations: 5,
    iterationsPerCycle: 2,
    reflectionCycles: 2,
    temperature: 0.25,
    maxTokens: 1536,
    topP: 0.9,
    promptStyle: 'concise',
    useChainOfThought: true,
    useKnowledge: true,
    knowledgeChunkSize: 600,
    batchSize: 1,
    parallelTasks: 2,
    timeoutMs: 45000,
    qualityThreshold: 0.80,
    minimumProgress: 0.08,
    stallThreshold: 3,
  },

  'ollama:deepseek-coder:6.7b': {
    provider: 'ollama',
    model: 'deepseek-coder:6.7b',
    maxIterations: 6,
    iterationsPerCycle: 3,
    reflectionCycles: 2,
    temperature: 0.15,
    maxTokens: 1024,
    topP: 0.95,
    promptStyle: 'structured',
    useChainOfThought: true,
    useKnowledge: true,
    knowledgeChunkSize: 500,
    batchSize: 1,
    parallelTasks: 1,
    timeoutMs: 30000,
    qualityThreshold: 0.78,
    minimumProgress: 0.09,
    stallThreshold: 3,
  },

  'ollama:phind-codellama:34b': {
    provider: 'ollama',
    model: 'phind-codellama:34b',
    maxIterations: 3,
    iterationsPerCycle: 1,
    reflectionCycles: 1,
    temperature: 0.3,
    maxTokens: 2048,
    topP: 0.9,
    promptStyle: 'concise',
    useChainOfThought: false,
    useKnowledge: true,
    knowledgeChunkSize: 800,
    batchSize: 1,
    parallelTasks: 3,
    timeoutMs: 60000,
    qualityThreshold: 0.85,
    minimumProgress: 0.07,
    stallThreshold: 2,
  },

  'ollama:qwen2.5-coder:7b': {
    provider: 'ollama',
    model: 'qwen2.5-coder:7b',
    maxIterations: 6,
    iterationsPerCycle: 3,
    reflectionCycles: 2,
    temperature: 0.2,
    maxTokens: 1536,
    topP: 0.9,
    promptStyle: 'structured',
    useChainOfThought: true,
    useKnowledge: true,
    knowledgeChunkSize: 600,
    batchSize: 1,
    parallelTasks: 2,
    timeoutMs: 35000,
    qualityThreshold: 0.80,
    minimumProgress: 0.08,
    stallThreshold: 3,
  },

  'ollama:mistral:7b': {
    provider: 'ollama',
    model: 'mistral:7b',
    maxIterations: 5,
    iterationsPerCycle: 2,
    reflectionCycles: 2,
    temperature: 0.3,
    maxTokens: 1024,
    topP: 0.9,
    promptStyle: 'concise',
    useChainOfThought: true,
    useKnowledge: true,
    knowledgeChunkSize: 500,
    batchSize: 1,
    parallelTasks: 2,
    timeoutMs: 30000,
    qualityThreshold: 0.75,
    minimumProgress: 0.1,
    stallThreshold: 3,
  },

  // Cloud Models (Anthropic)
  'anthropic:claude-3-5-sonnet': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxIterations: 3,
    iterationsPerCycle: 1,
    reflectionCycles: 1,
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    promptStyle: 'detailed',
    useChainOfThought: false,
    useKnowledge: false,
    knowledgeChunkSize: 1000,
    batchSize: 1,
    parallelTasks: 5,
    timeoutMs: 120000,
    qualityThreshold: 0.90,
    minimumProgress: 0.05,
    stallThreshold: 2,
  },

  'anthropic:claude-3-opus': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    maxIterations: 2,
    iterationsPerCycle: 1,
    reflectionCycles: 1,
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    promptStyle: 'detailed',
    useChainOfThought: false,
    useKnowledge: false,
    knowledgeChunkSize: 1200,
    batchSize: 1,
    parallelTasks: 5,
    timeoutMs: 120000,
    qualityThreshold: 0.92,
    minimumProgress: 0.05,
    stallThreshold: 2,
  },

  'anthropic:claude-3-haiku': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    maxIterations: 4,
    iterationsPerCycle: 2,
    reflectionCycles: 1,
    temperature: 0.6,
    maxTokens: 2048,
    topP: 0.9,
    promptStyle: 'concise',
    useChainOfThought: true,
    useKnowledge: false,
    knowledgeChunkSize: 800,
    batchSize: 1,
    parallelTasks: 8,
    timeoutMs: 60000,
    qualityThreshold: 0.85,
    minimumProgress: 0.07,
    stallThreshold: 2,
  },
}

export class ModelConfigManager {
  /**
   * Get strategy for a specific model
   */
  static getStrategy(provider: string, model: string): ModelStrategy {
    // Try exact match
    const key = `${provider}:${model}`
    if (MODEL_STRATEGIES[key]) {
      return MODEL_STRATEGIES[key]
    }

    // Try model family match
    for (const [strategyKey, strategy] of Object.entries(MODEL_STRATEGIES)) {
      if (strategyKey.includes(provider) && model.includes(strategy.model.split(':')[0])) {
        return strategy
      }
    }

    // Default to local small model strategy
    return MODEL_STRATEGIES['ollama:codellama:7b']
  }

  /**
   * Get strategy by key
   */
  static getStrategyByKey(key: string): ModelStrategy | undefined {
    return MODEL_STRATEGIES[key]
  }

  /**
   * List all available strategies
   */
  static listStrategies(): Array<{ key: string; provider: string; model: string }> {
    return Object.entries(MODEL_STRATEGIES).map(([key, strategy]) => ({
      key,
      provider: strategy.provider,
      model: strategy.model,
    }))
  }

  /**
   * Get strategies for a provider
   */
  static getProviderStrategies(provider: string): ModelStrategy[] {
    return Object.values(MODEL_STRATEGIES).filter((s) => s.provider === provider)
  }

  /**
   * Create custom strategy
   */
  static createCustomStrategy(
    base: ModelStrategy,
    overrides: Partial<ModelStrategy>
  ): ModelStrategy {
    return {
      ...base,
      ...overrides,
    }
  }

  /**
   * Optimize strategy for task type
   */
  static optimizeForTask(
    strategy: ModelStrategy,
    taskType: 'code-generation' | 'debugging' | 'refactoring' | 'analysis'
  ): ModelStrategy {
    const optimizations: Record<string, Partial<ModelStrategy>> = {
      'code-generation': {
        temperature: Math.max(0.1, strategy.temperature - 0.1),
        useChainOfThought: true,
        reflectionCycles: strategy.reflectionCycles + 1,
      },
      'debugging': {
        temperature: 0.1,
        maxIterations: strategy.maxIterations + 2,
        useKnowledge: true,
      },
      'refactoring': {
        temperature: 0.15,
        reflectionCycles: strategy.reflectionCycles + 1,
        qualityThreshold: Math.min(0.95, strategy.qualityThreshold + 0.05),
      },
      'analysis': {
        temperature: 0.3,
        maxTokens: Math.min(4096, strategy.maxTokens * 1.5),
        useKnowledge: true,
      },
    }

    return this.createCustomStrategy(strategy, optimizations[taskType] || {})
  }

  /**
   * Get recommended model for task
   */
  static recommendModel(
    taskComplexity: 'simple' | 'moderate' | 'complex',
    preferLocal: boolean = true
  ): string {
    if (preferLocal) {
      switch (taskComplexity) {
        case 'simple':
          return 'ollama:mistral:7b'
        case 'moderate':
          return 'ollama:codellama:13b'
        case 'complex':
          return 'ollama:phind-codellama:34b'
      }
    } else {
      switch (taskComplexity) {
        case 'simple':
          return 'anthropic:claude-3-haiku'
        case 'moderate':
          return 'anthropic:claude-3-5-sonnet'
        case 'complex':
          return 'anthropic:claude-3-opus'
      }
    }
  }
}

export default ModelConfigManager
