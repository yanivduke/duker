/**
 * Iteration Controller
 *
 * Manages iteration cycles with intelligent stopping conditions.
 * Prevents infinite loops while allowing deep reasoning when needed.
 */

import {
  IterationConfig,
  IterationState,
  StoppingDecision,
  StoppingReason,
  CritiqueResult,
} from './types';

export class IterationController {
  private config: IterationConfig;
  private qualityHistory: number[] = [];
  private confidenceHistory: number[] = [];

  constructor(config: Partial<IterationConfig> = {}) {
    this.config = {
      maxThinkingTokens: config.maxThinkingTokens ?? 10000,
      maxCycles: config.maxCycles ?? 20,
      maxDuration: config.maxDuration ?? 300000, // 5 minutes
      minConfidence: config.minConfidence ?? 0.85,
      minQuality: config.minQuality ?? 0.90,
      minImprovement: config.minImprovement ?? 0.05,
      stalledCycles: config.stalledCycles ?? 3,
      earlyStopConfidence: config.earlyStopConfidence ?? 0.95,
      enableWebSearch: config.enableWebSearch ?? true,
      enableCodebaseContext: config.enableCodebaseContext ?? true,
      showThinkingSteps: config.showThinkingSteps ?? false,
      thinkingVisibility: config.thinkingVisibility ?? 'summary',
    };
  }

  /**
   * Determine if iteration should continue
   */
  shouldContinue(state: IterationState): StoppingDecision {
    this.qualityHistory.push(state.currentQuality);
    this.confidenceHistory.push(state.currentConfidence);

    // Check token budget
    if (state.tokensUsed >= this.config.maxThinkingTokens) {
      return {
        shouldStop: true,
        reason: 'max_tokens',
        metrics: this.getMetrics(state),
        explanation: `Token budget exhausted (${state.tokensUsed}/${this.config.maxThinkingTokens})`,
      };
    }

    // Check max iterations
    if (state.cycle >= this.config.maxCycles) {
      return {
        shouldStop: true,
        reason: 'max_iterations',
        metrics: this.getMetrics(state),
        explanation: `Maximum cycles reached (${state.cycle}/${this.config.maxCycles})`,
      };
    }

    // Check timeout
    const duration = Date.now() - state.startTime;
    if (duration >= this.config.maxDuration) {
      return {
        shouldStop: true,
        reason: 'timeout',
        metrics: this.getMetrics(state),
        explanation: `Time limit exceeded (${Math.round(duration / 1000)}s)`,
      };
    }

    // Early stop if very high confidence
    if (state.currentConfidence >= this.config.earlyStopConfidence) {
      return {
        shouldStop: true,
        reason: 'confidence_met',
        metrics: this.getMetrics(state),
        explanation: `High confidence achieved (${state.currentConfidence.toFixed(2)})`,
      };
    }

    // Check if quality threshold met
    if (
      state.currentQuality >= this.config.minQuality &&
      state.currentConfidence >= this.config.minConfidence
    ) {
      return {
        shouldStop: true,
        reason: 'quality_met',
        metrics: this.getMetrics(state),
        explanation: `Quality and confidence thresholds met (Q: ${state.currentQuality.toFixed(2)}, C: ${state.currentConfidence.toFixed(2)})`,
      };
    }

    // Check for stalled progress
    if (state.cyclesSinceImprovement >= this.config.stalledCycles) {
      return {
        shouldStop: true,
        reason: 'stalled',
        metrics: this.getMetrics(state),
        explanation: `No significant improvement for ${state.cyclesSinceImprovement} cycles`,
      };
    }

    // Check for diminishing returns
    if (this.isDiminishingReturns()) {
      return {
        shouldStop: true,
        reason: 'diminishing_returns',
        metrics: this.getMetrics(state),
        explanation: 'Improvements are becoming negligible',
      };
    }

    // Continue iterating
    return {
      shouldStop: false,
      reason: 'quality_met', // Placeholder, not used when shouldStop=false
      metrics: this.getMetrics(state),
    };
  }

  /**
   * Track improvement from previous iteration
   */
  trackImprovement(previous: any, current: any): number {
    if (!previous) return 0;

    // For critique results
    if ('solutionQuality' in current && 'solutionQuality' in previous) {
      return current.solutionQuality - previous.solutionQuality;
    }

    // For generic numeric comparison
    if (typeof current === 'number' && typeof previous === 'number') {
      return current - previous;
    }

    return 0;
  }

  /**
   * Detect if progress has stalled
   */
  detectStall(history: number[]): boolean {
    if (history.length < this.config.stalledCycles) {
      return false;
    }

    const recentHistory = history.slice(-this.config.stalledCycles);
    const improvements = [];

    for (let i = 1; i < recentHistory.length; i++) {
      improvements.push(recentHistory[i] - recentHistory[i - 1]);
    }

    // Check if all recent improvements are below threshold
    return improvements.every(imp => Math.abs(imp) < this.config.minImprovement);
  }

  /**
   * Check for diminishing returns
   */
  private isDiminishingReturns(): boolean {
    if (this.qualityHistory.length < 5) return false;

    const recent = this.qualityHistory.slice(-5);
    const improvements = [];

    for (let i = 1; i < recent.length; i++) {
      improvements.push(recent[i] - recent[i - 1]);
    }

    // If improvements are consistently small and decreasing
    const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
    return avgImprovement < this.config.minImprovement / 2;
  }

  /**
   * Get current iteration metrics
   */
  private getMetrics(state: IterationState) {
    return {
      currentQuality: state.currentQuality,
      currentConfidence: state.currentConfidence,
      improvement: state.lastImprovement,
      cyclesStalled: state.cyclesSinceImprovement,
      tokensUsed: state.tokensUsed,
      duration: Date.now() - state.startTime,
    };
  }

  /**
   * Update state after a critique
   */
  updateStateFromCritique(state: IterationState, critique: CritiqueResult): IterationState {
    const improvement = critique.improvement ?? 0;
    const cyclesSinceImprovement =
      improvement >= this.config.minImprovement ? 0 : state.cyclesSinceImprovement + 1;

    return {
      ...state,
      currentQuality: critique.solutionQuality,
      currentConfidence: critique.overallConfidence,
      lastImprovement: improvement,
      cyclesSinceImprovement,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): IterationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<IterationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Reset history (for new task)
   */
  reset(): void {
    this.qualityHistory = [];
    this.confidenceHistory = [];
  }

  /**
   * Get quality and confidence trends
   */
  getTrends(): {
    qualityTrend: 'improving' | 'declining' | 'stable';
    confidenceTrend: 'improving' | 'declining' | 'stable';
    averageImprovement: number;
  } {
    return {
      qualityTrend: this.calculateTrend(this.qualityHistory),
      confidenceTrend: this.calculateTrend(this.confidenceHistory),
      averageImprovement: this.calculateAverageImprovement(this.qualityHistory),
    };
  }

  /**
   * Calculate trend from history
   */
  private calculateTrend(history: number[]): 'improving' | 'declining' | 'stable' {
    if (history.length < 3) return 'stable';

    const recent = history.slice(-3);
    const earlier = history.slice(0, -3);

    if (earlier.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    const diff = recentAvg - earlierAvg;
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Calculate average improvement per cycle
   */
  private calculateAverageImprovement(history: number[]): number {
    if (history.length < 2) return 0;

    const improvements = [];
    for (let i = 1; i < history.length; i++) {
      improvements.push(history[i] - history[i - 1]);
    }

    return improvements.reduce((a, b) => a + b, 0) / improvements.length;
  }

  /**
   * Recommend whether to enable parallel thinking
   */
  shouldEnableParallelThinking(state: IterationState): boolean {
    // Enable parallel thinking if:
    // 1. We're stuck (no improvement)
    // 2. Quality is moderate but not high
    // 3. We have token budget remaining
    return (
      state.cyclesSinceImprovement >= 2 &&
      state.currentQuality < 0.85 &&
      state.tokensUsed < this.config.maxThinkingTokens * 0.6
    );
  }

  /**
   * Recommend whether to trigger research
   */
  shouldTriggerResearch(critique: CritiqueResult, state: IterationState): boolean {
    return (
      this.config.enableWebSearch &&
      critique.needsMoreResearch &&
      state.researchPerformed < 3 && // Limit research operations
      state.tokensUsed < this.config.maxThinkingTokens * 0.8
    );
  }

  /**
   * Recommend whether to retrieve codebase context
   */
  shouldRetrieveContext(critique: CritiqueResult, state: IterationState): boolean {
    return (
      this.config.enableCodebaseContext &&
      critique.needsCodebaseContext &&
      state.contextRetrievals < 2 && // Limit context operations
      state.tokensUsed < this.config.maxThinkingTokens * 0.8
    );
  }
}
