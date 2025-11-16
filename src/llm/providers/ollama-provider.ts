/**
 * Ollama Provider for Local LLMs
 * Supports local models like CodeLlama, Mistral, Llama2, etc.
 */

import { createOllama } from 'ollama-ai-provider'
import { generateText, streamText } from 'ai'
import {
  LLMProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  ModelConfig,
} from '../../types/index.js'

export class OllamaProvider implements LLMProvider {
  name = 'ollama'

  models: ModelConfig[] = [
    {
      id: 'codellama:13b',
      name: 'CodeLlama 13B',
      contextWindow: 16384,
      strengths: ['code-generation', 'code-completion', 'debugging'],
    },
    {
      id: 'codellama:7b',
      name: 'CodeLlama 7B',
      contextWindow: 16384,
      strengths: ['code-generation', 'speed', 'simple-tasks'],
    },
    {
      id: 'mistral:7b',
      name: 'Mistral 7B',
      contextWindow: 8192,
      strengths: ['general-purpose', 'reasoning', 'speed'],
    },
    {
      id: 'llama2:13b',
      name: 'Llama 2 13B',
      contextWindow: 4096,
      strengths: ['reasoning', 'conversation', 'analysis'],
    },
    {
      id: 'llama2:7b',
      name: 'Llama 2 7B',
      contextWindow: 4096,
      strengths: ['speed', 'simple-tasks', 'cost-effective'],
    },
    {
      id: 'deepseek-coder:6.7b',
      name: 'DeepSeek Coder 6.7B',
      contextWindow: 16384,
      strengths: ['code-generation', 'code-analysis', 'debugging'],
    },
    {
      id: 'phind-codellama:34b',
      name: 'Phind CodeLlama 34B',
      contextWindow: 16384,
      strengths: ['code-generation', 'complex-reasoning', 'tool-use'],
    },
    {
      id: 'qwen2.5-coder:7b',
      name: 'Qwen 2.5 Coder 7B',
      contextWindow: 32768,
      strengths: ['code-generation', 'multilingual', 'long-context'],
    },
  ]

  private baseUrl: string
  private defaultModel: string

  constructor(baseUrl = 'http://localhost:11434', defaultModel = 'codellama:7b') {
    this.baseUrl = baseUrl
    this.defaultModel = defaultModel
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const ollama = createOllama({ baseURL: this.baseUrl })
    const model = ollama(request.model || this.defaultModel)

    try {
      const result = await generateText({
        model: model as any, // Type cast for compatibility
        messages: request.messages,
        temperature: request.temperature ?? 0.3, // Lower temp for code generation
        maxOutputTokens: request.maxTokens ?? 2048,
        topP: request.topP ?? 0.9,
      } as any)

      return {
        text: result.text,
        usage: {
          promptTokens: (result.usage as any)?.prompt ?? 0,
          completionTokens: (result.usage as any)?.completion ?? 0,
          totalTokens: (result.usage as any)?.total ?? 0,
        },
        finishReason: this.mapFinishReason(result.finishReason),
      }
    } catch (error: any) {
      throw new Error(`Ollama generation failed: ${error.message}`)
    }
  }

  async *stream(request: GenerateRequest): AsyncIterable<StreamChunk> {
    const ollama = createOllama({ baseURL: this.baseUrl })
    const model = ollama(request.model || this.defaultModel)

    try {
      const result = streamText({
        model: model as any, // Type cast for compatibility
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 2048,
      } as any)

      for await (const chunk of result.textStream) {
        yield { content: chunk, done: false }
      }

      yield { content: '', done: true }
    } catch (error: any) {
      throw new Error(`Ollama streaming failed: ${error.message}`)
    }
  }

  private mapFinishReason(reason: string): 'stop' | 'length' | 'content-filter' | 'error' {
    switch (reason) {
      case 'stop':
      case 'end':
        return 'stop'
      case 'length':
      case 'max_tokens':
        return 'length'
      case 'content_filter':
        return 'content-filter'
      default:
        return 'error'
    }
  }

  /**
   * Check if Ollama server is running and accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * List available models from Ollama
   */
  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) return []

      const data: any = await response.json()
      return data.models?.map((m: any) => m.name) ?? []
    } catch {
      return []
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      })

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`)
      }
    } catch (error: any) {
      throw new Error(`Model pull failed: ${error.message}`)
    }
  }
}
