/**
 * Anthropic Claude Provider
 */

import { anthropic } from '@ai-sdk/anthropic'
import { generateText, streamText } from 'ai'
import {
  LLMProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  ModelConfig,
} from '../../types/index.js'

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

  constructor(apiKey: string, defaultModel = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey
    this.defaultModel = defaultModel
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const model = anthropic(request.model || this.defaultModel, {
      apiKey: this.apiKey,
    })

    const result = await generateText({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4096,
      topP: request.topP,
    })

    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      finishReason: this.mapFinishReason(result.finishReason),
    }
  }

  async *stream(request: GenerateRequest): AsyncIterable<StreamChunk> {
    const model = anthropic(request.model || this.defaultModel, {
      apiKey: this.apiKey,
    })

    const result = streamText({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4096,
    })

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
