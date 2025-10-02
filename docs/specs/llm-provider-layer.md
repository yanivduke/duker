# LLM Provider Layer Specification

## Overview

The LLM Provider Layer abstracts LLM interactions using Vercel AI SDK, enabling seamless multi-provider support (Anthropic, OpenAI, Google, etc.) with a unified interface.

## Core Architecture

```typescript
interface LLMProvider {
  name: string
  models: ModelConfig[]
  generate(request: GenerateRequest): Promise<GenerateResponse>
  stream(request: GenerateRequest): AsyncIterable<StreamChunk>
  generateObject(request: ObjectRequest): Promise<ObjectResponse>
  generateWithTools(request: ToolRequest): Promise<ToolResponse>
}
```

## Vercel AI SDK Integration

### Installation & Setup

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google
```

### Provider Configuration

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'

interface ProviderConfig {
  anthropic: {
    apiKey: string
    models: {
      'claude-3-5-sonnet': string
      'claude-3-opus': string
      'claude-3-haiku': string
    }
  }
  openai: {
    apiKey: string
    models: {
      'gpt-4': string
      'gpt-4-turbo': string
      'gpt-3.5-turbo': string
    }
  }
  google: {
    apiKey: string
    models: {
      'gemini-pro': string
      'gemini-pro-vision': string
    }
  }
}
```

## Provider Implementations

### Anthropic Claude Provider

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { generateText, streamText } from 'ai'

class AnthropicProvider implements LLMProvider {
  name = 'anthropic'

  models = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      strengths: ['reasoning', 'long-context', 'tool-use']
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      contextWindow: 200000,
      strengths: ['complex-reasoning', 'analysis']
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      contextWindow: 200000,
      strengths: ['speed', 'cost-effective']
    }
  ]

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const result = await generateText({
      model: anthropic(request.model || 'claude-3-5-sonnet-20241022'),
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4096,
    })

    return {
      text: result.text,
      usage: result.usage,
      finishReason: result.finishReason
    }
  }

  async *stream(request: GenerateRequest): AsyncIterable<StreamChunk> {
    const result = streamText({
      model: anthropic(request.model || 'claude-3-5-sonnet-20241022'),
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
    })

    for await (const chunk of result.textStream) {
      yield { content: chunk, done: false }
    }

    yield { content: '', done: true }
  }

  async generateWithTools(request: ToolRequest): Promise<ToolResponse> {
    const result = await generateText({
      model: anthropic(request.model || 'claude-3-5-sonnet-20241022'),
      messages: request.messages,
      tools: request.tools,
      maxSteps: request.maxSteps ?? 5,
    })

    return {
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      usage: result.usage
    }
  }
}
```

### OpenAI Provider

```typescript
import { openai } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'

class OpenAIProvider implements LLMProvider {
  name = 'openai'

  models = [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextWindow: 128000,
      strengths: ['code-generation', 'speed', 'general-purpose']
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      contextWindow: 8192,
      strengths: ['reasoning', 'code-generation']
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      contextWindow: 16384,
      strengths: ['speed', 'cost-effective']
    }
  ]

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const result = await generateText({
      model: openai(request.model || 'gpt-4-turbo'),
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4096,
    })

    return {
      text: result.text,
      usage: result.usage,
      finishReason: result.finishReason
    }
  }

  async *stream(request: GenerateRequest): AsyncIterable<StreamChunk> {
    const result = streamText({
      model: openai(request.model || 'gpt-4-turbo'),
      messages: request.messages,
    })

    for await (const chunk of result.textStream) {
      yield { content: chunk, done: false }
    }
  }
}
```

### Google Gemini Provider

```typescript
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

class GoogleProvider implements LLMProvider {
  name = 'google'

  models = [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextWindow: 1000000,
      strengths: ['multi-modal', 'long-context']
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextWindow: 1000000,
      strengths: ['speed', 'multi-modal']
    }
  ]

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const result = await generateText({
      model: google(request.model || 'gemini-1.5-pro'),
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
    })

    return {
      text: result.text,
      usage: result.usage,
      finishReason: result.finishReason
    }
  }
}
```

## Unified LLM Manager

```typescript
class LLMManager {
  private providers: Map<string, LLMProvider> = new Map()
  private defaultProvider: string = 'anthropic'

  constructor() {
    this.registerProvider(new AnthropicProvider())
    this.registerProvider(new OpenAIProvider())
    this.registerProvider(new GoogleProvider())
  }

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider)
  }

  getProvider(name?: string): LLMProvider {
    const providerName = name || this.defaultProvider
    const provider = this.providers.get(providerName)

    if (!provider) {
      throw new Error(`Provider ${providerName} not found`)
    }

    return provider
  }

  async generate(
    request: GenerateRequest,
    provider?: string
  ): Promise<GenerateResponse> {
    return await this.getProvider(provider).generate(request)
  }

  async stream(
    request: GenerateRequest,
    provider?: string
  ): AsyncIterable<StreamChunk> {
    return this.getProvider(provider).stream(request)
  }

  async generateWithTools(
    request: ToolRequest,
    provider?: string
  ): Promise<ToolResponse> {
    return await this.getProvider(provider).generateWithTools(request)
  }
}
```

## Model Selection Strategy

```typescript
interface ModelSelector {
  selectModel(task: TaskAnalysis): ModelSelection
}

interface ModelSelection {
  provider: string
  model: string
  reasoning: string
}

class IntelligentModelSelector implements ModelSelector {
  selectModel(task: TaskAnalysis): ModelSelection {
    // Complex reasoning tasks → Claude Opus
    if (task.complexity === 'very-complex' && task.requiresReasoning) {
      return {
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        reasoning: 'Complex reasoning requires Claude Opus capabilities'
      }
    }

    // Long context tasks → Claude or Gemini
    if (task.contextSize > 100000) {
      return {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Large context best handled by Claude'
      }
    }

    // Multi-modal tasks → Gemini
    if (task.requiresMultiModal) {
      return {
        provider: 'google',
        model: 'gemini-1.5-pro',
        reasoning: 'Multi-modal capabilities need Gemini'
      }
    }

    // Code generation → GPT-4
    if (task.type === 'code-generation' && task.complexity === 'moderate') {
      return {
        provider: 'openai',
        model: 'gpt-4-turbo',
        reasoning: 'Fast, reliable code generation'
      }
    }

    // Tool use → Claude
    if (task.requiresTools) {
      return {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Superior tool use capabilities'
      }
    }

    // Fast iterations → GPT-3.5 or Haiku
    if (task.priority === 'speed') {
      return {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        reasoning: 'Speed-optimized model'
      }
    }

    // Default → Claude Sonnet
    return {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      reasoning: 'Balanced performance for general tasks'
    }
  }
}
```

## Request/Response Types

```typescript
interface GenerateRequest {
  messages: Message[]
  model?: string
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
  topP?: number
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GenerateResponse {
  text: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: 'stop' | 'length' | 'content-filter' | 'error'
}

interface StreamChunk {
  content: string
  done: boolean
}

interface ToolRequest extends GenerateRequest {
  tools: ToolDefinition[]
  maxSteps?: number
}

interface ToolResponse extends GenerateResponse {
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
}
```

## Structured Output Generation

```typescript
import { generateObject } from 'ai'
import { z } from 'zod'

async function generateStructured<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  provider: LLMProvider
): Promise<T> {
  const result = await generateObject({
    model: provider.getModel(),
    schema,
    prompt
  })

  return result.object
}

// Example: Generate code analysis
const analysisSchema = z.object({
  complexity: z.number(),
  issues: z.array(z.object({
    type: z.string(),
    severity: z.string(),
    description: z.string()
  })),
  suggestions: z.array(z.string())
})

const analysis = await generateStructured(
  analysisSchema,
  'Analyze this code: ...',
  anthropicProvider
)
```

## Error Handling & Retry Logic

```typescript
class ResilientLLMManager extends LLMManager {
  async generateWithRetry(
    request: GenerateRequest,
    provider?: string,
    maxRetries: number = 3
  ): Promise<GenerateResponse> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generate(request, provider)
      } catch (error) {
        lastError = error as Error

        // Rate limit → exponential backoff
        if (this.isRateLimitError(error)) {
          await this.delay(1000 * Math.pow(2, attempt))
          continue
        }

        // Provider error → try fallback
        if (this.isProviderError(error) && attempt < maxRetries) {
          provider = this.selectFallbackProvider(provider)
          continue
        }

        // Unrecoverable error
        throw error
      }
    }

    throw lastError!
  }

  private selectFallbackProvider(current?: string): string {
    const fallbackChain = {
      'anthropic': 'openai',
      'openai': 'google',
      'google': 'anthropic'
    }

    return fallbackChain[current || this.defaultProvider]
  }

  private isRateLimitError(error: any): boolean {
    return error?.status === 429 || error?.code === 'rate_limit_exceeded'
  }

  private isProviderError(error: any): boolean {
    return error?.status >= 500 || error?.code === 'service_unavailable'
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

## Cost Tracking

```typescript
interface CostTracker {
  trackUsage(provider: string, usage: Usage): void
  getCost(provider: string): number
  getTotalCost(): number
}

class LLMCostTracker implements CostTracker {
  private usage: Map<string, Usage[]> = new Map()

  private pricing = {
    anthropic: {
      'claude-3-5-sonnet-20241022': {
        input: 0.003,  // per 1K tokens
        output: 0.015
      },
      'claude-3-opus-20240229': {
        input: 0.015,
        output: 0.075
      }
    },
    openai: {
      'gpt-4-turbo': {
        input: 0.01,
        output: 0.03
      },
      'gpt-3.5-turbo': {
        input: 0.0005,
        output: 0.0015
      }
    }
  }

  trackUsage(provider: string, model: string, usage: Usage): void {
    const usageList = this.usage.get(`${provider}:${model}`) || []
    usageList.push(usage)
    this.usage.set(`${provider}:${model}`, usageList)
  }

  getCost(provider: string, model: string): number {
    const usageList = this.usage.get(`${provider}:${model}`) || []
    const pricing = this.pricing[provider]?.[model]

    if (!pricing) return 0

    return usageList.reduce((total, usage) => {
      const inputCost = (usage.promptTokens / 1000) * pricing.input
      const outputCost = (usage.completionTokens / 1000) * pricing.output
      return total + inputCost + outputCost
    }, 0)
  }

  getTotalCost(): number {
    return Array.from(this.usage.keys()).reduce((total, key) => {
      const [provider, model] = key.split(':')
      return total + this.getCost(provider, model)
    }, 0)
  }
}
```

## Caching Strategy

```typescript
class CachedLLMManager extends ResilientLLMManager {
  private cache: Map<string, GenerateResponse> = new Map()
  private ttl: number = 3600000 // 1 hour

  async generate(
    request: GenerateRequest,
    provider?: string
  ): Promise<GenerateResponse> {
    const cacheKey = this.createCacheKey(request, provider)

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const response = await super.generate(request, provider)

    this.cache.set(cacheKey, response)
    setTimeout(() => this.cache.delete(cacheKey), this.ttl)

    return response
  }

  private createCacheKey(request: GenerateRequest, provider?: string): string {
    return `${provider}:${JSON.stringify(request)}`
  }
}
```

## Monitoring & Metrics

```typescript
interface LLMMetrics {
  requestCount: Map<string, number>
  averageLatency: Map<string, number>
  errorRate: Map<string, number>
  tokenUsage: Map<string, number>
  costByProvider: Map<string, number>
}

class LLMMonitor {
  private metrics: LLMMetrics = {
    requestCount: new Map(),
    averageLatency: new Map(),
    errorRate: new Map(),
    tokenUsage: new Map(),
    costByProvider: new Map()
  }

  trackRequest(provider: string, latency: number, success: boolean): void {
    // Update request count
    const count = this.metrics.requestCount.get(provider) || 0
    this.metrics.requestCount.set(provider, count + 1)

    // Update average latency
    const avgLatency = this.metrics.averageLatency.get(provider) || 0
    const newAvg = (avgLatency * count + latency) / (count + 1)
    this.metrics.averageLatency.set(provider, newAvg)

    // Update error rate
    if (!success) {
      const errors = this.metrics.errorRate.get(provider) || 0
      this.metrics.errorRate.set(provider, errors + 1)
    }
  }

  getMetrics(): LLMMetrics {
    return this.metrics
  }
}
```

## Best Practices

1. **Provider Selection**: Choose based on task requirements
2. **Error Handling**: Implement retry with exponential backoff
3. **Fallback Strategy**: Have backup providers ready
4. **Cost Tracking**: Monitor and optimize spending
5. **Caching**: Cache responses for identical requests
6. **Streaming**: Use for real-time user experience
7. **Structured Output**: Use schemas for reliable parsing
8. **Monitoring**: Track performance and costs

## Configuration Example

```typescript
// config/llm.config.ts
export const llmConfig = {
  defaultProvider: 'anthropic',
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: 'claude-3-5-sonnet-20241022'
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: 'gpt-4-turbo'
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      defaultModel: 'gemini-1.5-pro'
    }
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000
  },
  cache: {
    enabled: true,
    ttl: 3600000
  }
}
```
