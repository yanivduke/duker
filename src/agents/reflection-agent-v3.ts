/**
 * Reflection Agent V3 - Extended Thinking Edition
 *
 * Advanced reflection agent that uses the full extended thinking system:
 * - Deep iterative reasoning (100+ steps)
 * - Self-critique and refinement cycles
 * - Automatic web search integration
 * - Parallel thinking branches
 * - Transparent meta-cognition
 *
 * This is the most advanced agent in Duker, capable of Claude Code-level thinking.
 */

import { BaseLLMProvider } from '../llm/base-provider';
import { ExtendedThinkingEngine, ThinkingResult } from '../core/thinking/extended-thinking-engine';
import { ResearchOrchestrator } from '../core/thinking/research-orchestrator';
import { ParallelThinkingEngine } from '../core/thinking/parallel-thinking-engine';
import { WebSearchTool } from '../mcp/web-search-tool';
import { ContextTool } from '../mcp/context-tool';
import { AgentResponse, AgenticPattern } from '../types/agents';
import { IterationConfig, ResearchNeed, ContextNeed, BranchStrategy } from '../core/thinking/types';

export interface ReflectionAgentV3Config {
  // Thinking configuration
  thinkingConfig?: Partial<IterationConfig>;

  // Feature flags
  enableWebSearch?: boolean;
  enableCodebaseContext?: boolean;
  enableParallelThinking?: boolean;
  enableThinkingTransparency?: boolean;

  // Language and context
  language?: string;
  codebaseContext?: string;

  // Callbacks for UI updates
  onProgress?: (message: string, progress: number) => void;
  onThinkingStep?: (step: string) => void;
  onResearch?: (query: string) => void;
}

export class ReflectionAgentV3 {
  private thinkingEngine: ExtendedThinkingEngine;
  private researchOrchestrator?: ResearchOrchestrator;
  private parallelEngine?: ParallelThinkingEngine;

  constructor(
    private llmProvider: BaseLLMProvider,
    private config: ReflectionAgentV3Config = {},
    private webSearchTool?: WebSearchTool,
    private contextTool?: ContextTool
  ) {
    // Initialize thinking engine
    this.thinkingEngine = new ExtendedThinkingEngine(llmProvider, {
      config: {
        maxThinkingTokens: 15000,
        maxCycles: 25,
        minConfidence: 0.85,
        minQuality: 0.92,
        earlyStopConfidence: 0.95,
        enableWebSearch: config.enableWebSearch ?? true,
        enableCodebaseContext: config.enableCodebaseContext ?? true,
        thinkingVisibility: config.enableThinkingTransparency ? 'summary' : 'none',
        ...config.thinkingConfig,
      },
      onThinkingStep: step => {
        if (this.config.onThinkingStep) {
          this.config.onThinkingStep(`[${step.type}] ${step.content.substring(0, 100)}...`);
        }
      },
      onCycleComplete: state => {
        if (this.config.onProgress) {
          const progress = Math.min(state.currentQuality, state.cycle / 20);
          this.config.onProgress(
            `Cycle ${state.cycle}: Quality ${state.currentQuality.toFixed(2)}, Confidence ${state.currentConfidence.toFixed(2)}`,
            progress
          );
        }
      },
      onResearchNeeded: async (need: ResearchNeed) => {
        if (this.config.onResearch) {
          this.config.onResearch(need.question);
        }
        return this.performResearch(need);
      },
      onContextNeeded: async (need: ContextNeed) => {
        return this.retrieveContext(need);
      },
    });

    // Initialize research orchestrator if web search enabled
    if (config.enableWebSearch && webSearchTool) {
      this.researchOrchestrator = new ResearchOrchestrator(webSearchTool, llmProvider);
    }

    // Initialize parallel thinking if enabled
    if (config.enableParallelThinking) {
      this.parallelEngine = new ParallelThinkingEngine(llmProvider);
    }
  }

  /**
   * Execute the reflection agent with extended thinking
   */
  async execute(task: string, context?: any): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      if (this.config.onProgress) {
        this.config.onProgress('Initializing extended thinking...', 0);
      }

      // Detect if parallel thinking would be beneficial
      const shouldUseParallel =
        this.config.enableParallelThinking &&
        this.parallelEngine &&
        this.shouldUseParallelThinking(task);

      let result: ThinkingResult;

      if (shouldUseParallel) {
        result = await this.executeWithParallelThinking(task, context);
      } else {
        result = await this.executeWithDeepThinking(task, context);
      }

      const duration = Date.now() - startTime;

      // Build comprehensive response
      const output = this.formatOutput(task, result);

      return {
        success: true,
        output,
        metadata: {
          agent: 'reflection-v3',
          pattern: 'reflection' as AgenticPattern,
          iterations: result.iterations,
          finalQuality: result.quality,
          finalConfidence: result.confidence,
          tokensUsed: result.tokensUsed,
          duration,
          thinkingCycles: result.iterations,
          researchPerformed: result.researchPerformed,
          contextRetrievals: result.contextRetrievals,
          stoppingReason: result.stoppingReason,
        },
      };
    } catch (error: any) {
      console.error('ReflectionAgentV3 error:', error);
      return {
        success: false,
        output: '',
        error: error.message,
        metadata: {
          agent: 'reflection-v3',
          pattern: 'reflection' as AgenticPattern,
        },
      };
    }
  }

  /**
   * Execute with deep iterative thinking
   */
  private async executeWithDeepThinking(
    task: string,
    context?: any
  ): Promise<ThinkingResult> {
    if (this.config.onProgress) {
      this.config.onProgress('Starting deep reasoning...', 0.1);
    }

    const result = await this.thinkingEngine.think(task, {
      language: this.config.language || this.detectLanguage(task),
      codebaseContext: this.config.codebaseContext,
      userPreferences: context?.userPreferences,
    });

    return result;
  }

  /**
   * Execute with parallel thinking branches
   */
  private async executeWithParallelThinking(
    task: string,
    context?: any
  ): Promise<ThinkingResult> {
    if (!this.parallelEngine) {
      return this.executeWithDeepThinking(task, context);
    }

    if (this.config.onProgress) {
      this.config.onProgress('Exploring multiple approaches in parallel...', 0.1);
    }

    // Suggest strategies based on task
    const strategies = this.parallelEngine.suggestStrategies(task, {
      language: this.config.language,
    });

    // Explore branches
    const parallelResult = await this.parallelEngine.explore(task, strategies, {
      language: this.config.language || this.detectLanguage(task),
      maxBranches: 3,
    });

    if (this.config.onProgress) {
      this.config.onProgress('Synthesizing best solution from branches...', 0.7);
    }

    // Refine the synthesized solution with deep thinking
    const refinedResult = await this.thinkingEngine.think(task, {
      language: this.config.language || this.detectLanguage(task),
      codebaseContext: this.config.codebaseContext,
      initialSolution: parallelResult.synthesizedSolution,
    });

    // Enhance result with parallel thinking metadata
    return {
      ...refinedResult,
      solution: `${parallelResult.comparisonAnalysis}\n\n---\n\n${refinedResult.solution}`,
    };
  }

  /**
   * Perform web research
   */
  private async performResearch(need: ResearchNeed): Promise<string> {
    if (!this.researchOrchestrator) {
      return 'Web search not available';
    }

    try {
      const result = await this.researchOrchestrator.research(need);
      return result.synthesized;
    } catch (error) {
      console.error('Research failed:', error);
      return 'Research failed';
    }
  }

  /**
   * Retrieve codebase context
   */
  private async retrieveContext(need: ContextNeed): Promise<string> {
    if (!this.contextTool) {
      return 'Context retrieval not available';
    }

    try {
      // Use find operation to search codebase
      const results = await this.contextTool.execute({
        operation: 'find',
        pattern: need.query,
      });

      return JSON.stringify(results, null, 2);
    } catch (error) {
      console.error('Context retrieval failed:', error);
      return 'Context retrieval failed';
    }
  }

  /**
   * Detect programming language from task
   */
  private detectLanguage(task: string): string {
    const taskLower = task.toLowerCase();

    const languages = [
      { keywords: ['typescript', 'ts'], lang: 'TypeScript' },
      { keywords: ['javascript', 'js', 'node'], lang: 'JavaScript' },
      { keywords: ['python', 'py'], lang: 'Python' },
      { keywords: ['rust', 'cargo'], lang: 'Rust' },
      { keywords: ['go', 'golang'], lang: 'Go' },
      { keywords: ['java'], lang: 'Java' },
      { keywords: ['c++', 'cpp'], lang: 'C++' },
      { keywords: ['c#', 'csharp'], lang: 'C#' },
      { keywords: ['ruby'], lang: 'Ruby' },
      { keywords: ['php'], lang: 'PHP' },
      { keywords: ['swift'], lang: 'Swift' },
      { keywords: ['kotlin'], lang: 'Kotlin' },
    ];

    for (const { keywords, lang } of languages) {
      if (keywords.some(kw => taskLower.includes(kw))) {
        return lang;
      }
    }

    return 'TypeScript'; // Default for Duker
  }

  /**
   * Determine if parallel thinking should be used
   */
  private shouldUseParallelThinking(task: string): boolean {
    const taskLower = task.toLowerCase();

    // Use parallel thinking for complex design/architecture tasks
    const parallelIndicators = [
      'design',
      'architecture',
      'compare',
      'evaluate',
      'different approaches',
      'multiple ways',
      'best way',
      'tradeoffs',
      'alternatives',
    ];

    return parallelIndicators.some(indicator => taskLower.includes(indicator));
  }

  /**
   * Format the final output
   */
  private formatOutput(task: string, result: ThinkingResult): string {
    let output = '';

    // Add thinking summary if transparency enabled
    if (this.config.enableThinkingTransparency) {
      const summary = this.thinkingEngine.getSummary();
      output += `## 🧠 Thinking Summary\n\n`;
      output += `- **Cycles:** ${summary.totalCycles}\n`;
      output += `- **Total Steps:** ${summary.totalSteps}\n`;
      output += `- **Confidence:** ${(summary.averageConfidence * 100).toFixed(0)}%\n`;
      output += `- **Tokens:** ${summary.totalTokens.toLocaleString()}\n`;
      output += `- **Duration:** ${(summary.duration / 1000).toFixed(1)}s\n`;

      if (result.researchPerformed > 0) {
        output += `- **Research:** ${result.researchPerformed} web searches\n`;
      }

      output += `\n---\n\n`;
    }

    // Add quality assessment
    output += `## 📊 Quality Assessment\n\n`;
    output += `- **Solution Quality:** ${(result.quality * 100).toFixed(0)}% `;
    output += result.quality >= 0.9 ? '✅ Excellent' : result.quality >= 0.75 ? '✓ Good' : '⚠️ Needs Improvement';
    output += `\n`;
    output += `- **Confidence:** ${(result.confidence * 100).toFixed(0)}%\n`;
    output += `- **Iterations:** ${result.iterations}\n`;
    output += `\n---\n\n`;

    // Add the solution
    output += `## 💡 Solution\n\n`;
    output += result.solution;
    output += `\n`;

    return output;
  }

  /**
   * Reset for new task
   */
  reset(): void {
    this.thinkingEngine.reset();
  }
}
