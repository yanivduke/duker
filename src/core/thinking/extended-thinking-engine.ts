/**
 * Extended Thinking Engine
 *
 * Main orchestrator for deep, iterative reasoning with self-critique,
 * web search integration, and parallel exploration.
 */

import { BaseLLMProvider } from '../../llm/base-provider';
import { ThinkingStepManager } from './thinking-step-manager';
import { CritiqueEngine } from './critique-engine';
import { IterationController } from './iteration-controller';
import {
  ExtendedThinkingOptions,
  IterationState,
  CritiqueResult,
  ResearchNeed,
  ContextNeed,
  ThinkingStep,
} from './types';

export interface ThinkingResult<T = any> {
  solution: T;
  quality: number;
  confidence: number;
  iterations: number;
  tokensUsed: number;
  thinkingChain: any; // Full thinking chain for transparency
  stoppingReason: string;
  researchPerformed: number;
  contextRetrievals: number;
}

export class ExtendedThinkingEngine {
  private stepManager: ThinkingStepManager;
  private critiqueEngine: CritiqueEngine;
  private iterationController: IterationController;
  private options: ExtendedThinkingOptions;

  constructor(
    private llmProvider: BaseLLMProvider,
    options: Partial<ExtendedThinkingOptions> = {}
  ) {
    this.stepManager = new ThinkingStepManager();
    this.critiqueEngine = new CritiqueEngine(llmProvider);
    this.iterationController = new IterationController(options.config);

    this.options = {
      config: this.iterationController.getConfig(),
      ...options,
    };
  }

  /**
   * Execute deep thinking process for a task
   */
  async think<T = string>(
    task: string,
    context?: {
      language?: string;
      codebaseContext?: string;
      userPreferences?: any;
      initialSolution?: T;
    }
  ): Promise<ThinkingResult<T>> {
    // Initialize state
    const state: IterationState = {
      cycle: 0,
      chain: this.stepManager.getChain(),
      currentSolution: context?.initialSolution,
      currentQuality: 0,
      currentConfidence: 0,
      lastImprovement: 0,
      cyclesSinceImprovement: 0,
      tokensUsed: 0,
      startTime: Date.now(),
      researchPerformed: 0,
      contextRetrievals: 0,
    };

    let currentSolution = context?.initialSolution;
    let critique: CritiqueResult | undefined;

    // Main iteration loop
    while (true) {
      // Record thinking step: start cycle
      this.recordThinkingStep('reasoning', `Starting iteration cycle ${state.cycle}`, 0.5);

      // Generate or refine solution
      if (!currentSolution) {
        currentSolution = await this.generateInitialSolution(task, context);
      } else {
        currentSolution = await this.refineSolution(task, currentSolution, critique, context);
      }

      // Critique the solution
      critique = await this.critiqueEngine.critiqueSolution(task, currentSolution as any, {
        language: context?.language,
        previousCritique: critique,
        thinkingChain: this.stepManager.getChain(),
        codebaseContext: context?.codebaseContext,
      });

      // Record critique
      this.recordThinkingStep(
        'critique',
        `Quality: ${critique.solutionQuality.toFixed(2)}, Confidence: ${critique.overallConfidence.toFixed(2)}`,
        critique.overallConfidence
      );

      // Update state with critique results
      state.currentQuality = critique.solutionQuality;
      state.currentConfidence = critique.overallConfidence;
      state.lastImprovement = critique.improvement ?? 0;

      if (state.lastImprovement < this.options.config.minImprovement) {
        state.cyclesSinceImprovement++;
      } else {
        state.cyclesSinceImprovement = 0;
      }

      // Check if research is needed
      if (this.iterationController.shouldTriggerResearch(critique, state)) {
        await this.performResearch(critique, state);
      }

      // Check if codebase context is needed
      if (this.iterationController.shouldRetrieveContext(critique, state)) {
        await this.retrieveCodebaseContext(critique, state);
      }

      // Notify cycle complete
      if (this.options.onCycleComplete) {
        this.options.onCycleComplete(state);
      }

      // Check stopping conditions
      const stoppingDecision = this.iterationController.shouldContinue(state);
      if (stoppingDecision.shouldStop) {
        // Record final thinking step
        this.recordThinkingStep(
          'synthesis',
          `Stopping: ${stoppingDecision.reason} - ${stoppingDecision.explanation}`,
          state.currentConfidence
        );

        if (this.options.onStoppingDecision) {
          this.options.onStoppingDecision(stoppingDecision);
        }

        this.stepManager.complete();

        return {
          solution: currentSolution,
          quality: state.currentQuality,
          confidence: state.currentConfidence,
          iterations: state.cycle + 1,
          tokensUsed: state.tokensUsed,
          thinkingChain: this.stepManager.export(),
          stoppingReason: stoppingDecision.reason,
          researchPerformed: state.researchPerformed,
          contextRetrievals: state.contextRetrievals,
        };
      }

      // Next cycle
      state.cycle++;
      this.stepManager.nextCycle();
    }
  }

  /**
   * Generate initial solution
   */
  private async generateInitialSolution(
    task: string,
    context?: {
      language?: string;
      codebaseContext?: string;
      userPreferences?: any;
    }
  ): Promise<any> {
    this.recordThinkingStep('reasoning', 'Generating initial solution...', 0.3);

    const prompt = this.buildSolutionPrompt(task, context);

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 2000,
    });

    this.recordThinkingStep('observation', 'Initial solution generated', 0.5, response.usage?.totalTokens);

    return response.text;
  }

  /**
   * Refine existing solution based on critique
   */
  private async refineSolution(
    task: string,
    currentSolution: any,
    critique: CritiqueResult | undefined,
    context?: any
  ): Promise<any> {
    if (!critique) return currentSolution;

    this.recordThinkingStep(
      'reasoning',
      `Refining solution based on ${critique.criticalIssues.length} issues`,
      0.6
    );

    const prompt = `Improve this solution based on the critique:

**Task:** ${task}

**Current Solution:**
${currentSolution}

**Critical Issues:**
${critique.criticalIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

**Suggestions:**
${critique.suggestions.map((sug, i) => `${i + 1}. ${sug}`).join('\n')}

**Quality Scores:**
- Overall: ${critique.solutionQuality.toFixed(2)}
- Best Practices: ${critique.bestPractices.toFixed(2)}
- Edge Cases: ${critique.edgeCasesConsidered.toFixed(2)}

Provide an improved version that addresses ALL issues and suggestions. Focus on:
1. Fixing critical issues
2. Handling edge cases
3. Following best practices
4. Improving clarity and maintainability

${context?.language ? `Language: ${context.language}` : ''}`;

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      maxTokens: 2500,
    });

    this.recordThinkingStep('observation', 'Solution refined', 0.7, response.usage?.totalTokens);

    return response.text;
  }

  /**
   * Perform web research when needed
   */
  private async performResearch(critique: CritiqueResult, state: IterationState): Promise<void> {
    if (!this.options.onResearchNeeded || !critique.researchQueries?.length) {
      return;
    }

    this.recordThinkingStep(
      'reasoning',
      `Research needed: ${critique.researchQueries.length} queries`,
      0.4
    );

    for (const query of critique.researchQueries.slice(0, 2)) {
      // Limit to 2 searches per cycle
      const researchNeed: ResearchNeed = {
        question: query,
        urgency: 'helpful',
        searchType: 'general',
        maxResults: 5,
      };

      try {
        const results = await this.options.onResearchNeeded(researchNeed);
        this.recordThinkingStep('observation', `Research: ${query}`, 0.6, 0, {
          searchQuery: query,
        });

        state.researchPerformed++;

        // Add research results to context (simplified)
        // In practice, you'd store this for the next refinement
      } catch (error) {
        console.error('Research failed:', error);
      }
    }
  }

  /**
   * Retrieve codebase context when needed
   */
  private async retrieveCodebaseContext(
    critique: CritiqueResult,
    state: IterationState
  ): Promise<void> {
    if (!this.options.onContextNeeded) return;

    this.recordThinkingStep('reasoning', 'Retrieving codebase context...', 0.5);

    const contextNeed: ContextNeed = {
      type: 'similar_code',
      query: 'similar implementations',
      scope: 'entire_project',
      priority: 'medium',
    };

    try {
      const context = await this.options.onContextNeeded(contextNeed);
      this.recordThinkingStep('observation', 'Codebase context retrieved', 0.6);
      state.contextRetrievals++;
    } catch (error) {
      console.error('Context retrieval failed:', error);
    }
  }

  /**
   * Build solution generation prompt
   */
  private buildSolutionPrompt(
    task: string,
    context?: {
      language?: string;
      codebaseContext?: string;
      userPreferences?: any;
    }
  ): string {
    return `${task}

${context?.language ? `Language: ${context.language}\n` : ''}
${context?.codebaseContext ? `Codebase Context:\n${context.codebaseContext}\n` : ''}

Provide a high-quality solution that:
1. Solves the task completely
2. Follows best practices
3. Handles edge cases
4. Is well-documented
5. Is production-ready`;
  }

  /**
   * Record a thinking step
   */
  private recordThinkingStep(
    type: any,
    content: string,
    confidence: number,
    tokensUsed: number = 0,
    metadata?: any
  ): ThinkingStep {
    const step = this.stepManager.addStep(type, content, {
      confidence,
      tokensUsed,
      metadata,
    });

    if (this.options.onThinkingStep) {
      this.options.onThinkingStep(step);
    }

    return step;
  }

  /**
   * Get thinking summary
   */
  getSummary() {
    return this.stepManager.getSummary();
  }

  /**
   * Reset for new task
   */
  reset(): void {
    this.stepManager = new ThinkingStepManager();
    this.iterationController.reset();
  }
}
