/**
 * Base LLM Provider
 *
 * Abstract base class/interface for LLM providers used in agents.
 * Provides a simplified interface for thinking engines and agents.
 */

import {
  LLMProvider,
  GenerateRequest,
  GenerateResponse,
  Message,
} from '../types/index.js';

/**
 * Simplified LLM interface for agents and thinking engines
 */
export abstract class BaseLLMProvider {
  abstract name: string;

  /**
   * Generate text with simplified interface
   */
  abstract generateText(request: {
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
  }): Promise<{ text: string; usage?: any; metadata?: any }>;

  /**
   * Stream text generation (optional)
   */
  async *streamText?(request: {
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<{ content: string; done: boolean }> {
    // Default implementation - can be overridden
    const result = await this.generateText(request);
    yield { content: result.text, done: true };
  }
}

/**
 * Adapter to wrap LLMProvider as BaseLLMProvider
 */
export class LLMProviderAdapter extends BaseLLMProvider {
  name: string;

  constructor(private provider: LLMProvider) {
    super();
    this.name = provider.name;
  }

  async generateText(request: {
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
  }): Promise<{ text: string; usage?: any; metadata?: any }> {
    const result = await this.provider.generate({
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      stopSequences: request.stopSequences,
    });

    return {
      text: result.text,
      usage: result.usage,
      metadata: result.metadata,
    };
  }

  async *streamText(request: {
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<{ content: string; done: boolean }> {
    for await (const chunk of this.provider.stream({
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    })) {
      yield { content: chunk.content, done: chunk.done };
    }
  }
}
