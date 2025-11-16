/**
 * Thinking Step Manager
 *
 * Manages individual thinking steps and tracks reasoning chains.
 * Provides utilities for step recording, dependency tracking, and
 * circular reasoning detection.
 */

import { ThinkingStep, ThinkingChain, ThinkingStepType } from './types';
import { v4 as uuidv4 } from 'uuid';

export class ThinkingStepManager {
  private chain: ThinkingChain;

  constructor() {
    this.chain = {
      id: uuidv4(),
      steps: [],
      totalTokens: 0,
      maxDepth: 0,
      currentCycle: 0,
      branches: [],
      startTime: Date.now(),
    };
  }

  /**
   * Add a new thinking step to the chain
   */
  addStep(
    type: ThinkingStepType,
    content: string,
    options: {
      confidence?: number;
      tokensUsed?: number;
      dependencies?: string[];
      branchId?: string;
      metadata?: any;
    } = {}
  ): ThinkingStep {
    const step: ThinkingStep = {
      id: uuidv4(),
      cycle: this.chain.currentCycle,
      type,
      content,
      confidence: options.confidence ?? 0.5,
      tokensUsed: options.tokensUsed ?? 0,
      dependencies: options.dependencies ?? [],
      timestamp: Date.now(),
      branchId: options.branchId,
      metadata: options.metadata,
    };

    this.chain.steps.push(step);
    this.chain.totalTokens += step.tokensUsed;

    // Update max depth
    const stepDepth = this.calculateStepDepth(step);
    if (stepDepth > this.chain.maxDepth) {
      this.chain.maxDepth = stepDepth;
    }

    return step;
  }

  /**
   * Increment the current cycle
   */
  nextCycle(): number {
    this.chain.currentCycle++;
    return this.chain.currentCycle;
  }

  /**
   * Get all steps for a specific cycle
   */
  getStepsForCycle(cycle: number): ThinkingStep[] {
    return this.chain.steps.filter(step => step.cycle === cycle);
  }

  /**
   * Get all steps of a specific type
   */
  getStepsByType(type: ThinkingStepType): ThinkingStep[] {
    return this.chain.steps.filter(step => step.type === type);
  }

  /**
   * Get the most recent N steps
   */
  getRecentSteps(count: number): ThinkingStep[] {
    return this.chain.steps.slice(-count);
  }

  /**
   * Get steps for a specific branch
   */
  getStepsForBranch(branchId: string): ThinkingStep[] {
    return this.chain.steps.filter(step => step.branchId === branchId);
  }

  /**
   * Calculate the dependency depth of a step
   */
  private calculateStepDepth(step: ThinkingStep): number {
    if (step.dependencies.length === 0) {
      return 0;
    }

    const dependencyDepths = step.dependencies.map(depId => {
      const depStep = this.chain.steps.find(s => s.id === depId);
      if (!depStep) return 0;
      return this.calculateStepDepth(depStep);
    });

    return Math.max(...dependencyDepths) + 1;
  }

  /**
   * Detect circular dependencies in reasoning
   */
  hasCircularDependency(step: ThinkingStep): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (!visited.has(stepId)) {
        visited.add(stepId);
        recursionStack.add(stepId);

        const currentStep = this.chain.steps.find(s => s.id === stepId);
        if (currentStep) {
          for (const depId of currentStep.dependencies) {
            if (!visited.has(depId) && hasCycle(depId)) {
              return true;
            } else if (recursionStack.has(depId)) {
              return true;
            }
          }
        }
      }
      recursionStack.delete(stepId);
      return false;
    };

    return hasCycle(step.id);
  }

  /**
   * Get the average confidence across all steps
   */
  getAverageConfidence(): number {
    if (this.chain.steps.length === 0) return 0;
    const sum = this.chain.steps.reduce((acc, step) => acc + step.confidence, 0);
    return sum / this.chain.steps.length;
  }

  /**
   * Get the average confidence for the current cycle
   */
  getCurrentCycleConfidence(): number {
    const cycleSteps = this.getStepsForCycle(this.chain.currentCycle);
    if (cycleSteps.length === 0) return 0;
    const sum = cycleSteps.reduce((acc, step) => acc + step.confidence, 0);
    return sum / cycleSteps.length;
  }

  /**
   * Get confidence trend (improving, declining, stable)
   */
  getConfidenceTrend(): 'improving' | 'declining' | 'stable' {
    if (this.chain.currentCycle < 2) return 'stable';

    const previousCycle = this.getStepsForCycle(this.chain.currentCycle - 1);
    const currentCycle = this.getStepsForCycle(this.chain.currentCycle);

    if (previousCycle.length === 0 || currentCycle.length === 0) return 'stable';

    const prevAvg = previousCycle.reduce((acc, s) => acc + s.confidence, 0) / previousCycle.length;
    const currAvg = currentCycle.reduce((acc, s) => acc + s.confidence, 0) / currentCycle.length;

    const diff = currAvg - prevAvg;
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Get total tokens used in the chain
   */
  getTotalTokens(): number {
    return this.chain.totalTokens;
  }

  /**
   * Get the full thinking chain
   */
  getChain(): ThinkingChain {
    return this.chain;
  }

  /**
   * Get a summary of the thinking chain
   */
  getSummary(): {
    totalSteps: number;
    totalCycles: number;
    totalTokens: number;
    averageConfidence: number;
    maxDepth: number;
    duration: number;
    stepsByType: Record<ThinkingStepType, number>;
  } {
    const stepsByType: Record<string, number> = {};
    for (const step of this.chain.steps) {
      stepsByType[step.type] = (stepsByType[step.type] || 0) + 1;
    }

    return {
      totalSteps: this.chain.steps.length,
      totalCycles: this.chain.currentCycle + 1,
      totalTokens: this.chain.totalTokens,
      averageConfidence: this.getAverageConfidence(),
      maxDepth: this.chain.maxDepth,
      duration: this.chain.endTime
        ? this.chain.endTime - this.chain.startTime
        : Date.now() - this.chain.startTime,
      stepsByType: stepsByType as Record<ThinkingStepType, number>,
    };
  }

  /**
   * Mark the chain as complete
   */
  complete(): void {
    this.chain.endTime = Date.now();
  }

  /**
   * Export the chain for persistence or analysis
   */
  export(): ThinkingChain {
    return JSON.parse(JSON.stringify(this.chain));
  }

  /**
   * Import a previously exported chain
   */
  static import(chainData: ThinkingChain): ThinkingStepManager {
    const manager = new ThinkingStepManager();
    manager.chain = chainData;
    return manager;
  }
}
