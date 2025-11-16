/**
 * Parallel Thinking Engine
 *
 * Explores multiple solution approaches simultaneously and synthesizes
 * the best ideas into a comprehensive solution.
 */

import { BaseLLMProvider } from '../../llm/base-provider';
import { ThinkingBranch, BranchStrategy } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface ParallelThinkingResult {
  branches: ThinkingBranch[];
  synthesizedSolution: string;
  recommendedBranch: ThinkingBranch;
  comparisonAnalysis: string;
}

export class ParallelThinkingEngine {
  constructor(private llmProvider: BaseLLMProvider) {}

  /**
   * Explore multiple solution approaches in parallel
   */
  async explore(
    task: string,
    strategies: BranchStrategy[],
    context?: {
      language?: string;
      constraints?: string[];
      maxBranches?: number;
    }
  ): Promise<ParallelThinkingResult> {
    const maxBranches = Math.min(strategies.length, context?.maxBranches ?? 3);
    const selectedStrategies = strategies.slice(0, maxBranches);

    // Generate solutions for each branch in parallel
    const branchPromises = selectedStrategies.map(strategy =>
      this.exploreBranch(task, strategy, context)
    );

    const branches = await Promise.all(branchPromises);

    // Compare and rank branches
    const rankedBranches = await this.rankBranches(task, branches);

    // Synthesize best ideas
    const synthesized = await this.synthesizeBranches(task, rankedBranches);

    return {
      branches: rankedBranches,
      synthesizedSolution: synthesized,
      recommendedBranch: rankedBranches[0],
      comparisonAnalysis: await this.generateComparison(task, rankedBranches),
    };
  }

  /**
   * Explore a single branch with a specific strategy
   */
  private async exploreBranch(
    task: string,
    strategy: BranchStrategy,
    context?: {
      language?: string;
      constraints?: string[];
    }
  ): Promise<ThinkingBranch> {
    const branch: ThinkingBranch = {
      id: uuidv4(),
      strategy,
      description: this.getStrategyDescription(strategy),
      steps: [],
      tradeoffs: {
        pros: [],
        cons: [],
        complexity: 'medium',
        performance: 'medium',
        maintainability: 'medium',
      },
    };

    const prompt = this.buildBranchPrompt(task, strategy, context);

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7, // Higher temp for diverse solutions
      maxTokens: 2000,
    });

    branch.solution = response.text;

    // Extract tradeoffs from solution
    branch.tradeoffs = await this.extractTradeoffs(response.text);

    return branch;
  }

  /**
   * Build prompt for a specific branch strategy
   */
  private buildBranchPrompt(
    task: string,
    strategy: BranchStrategy,
    context?: {
      language?: string;
      constraints?: string[];
    }
  ): string {
    const strategyGuidance = this.getStrategyGuidance(strategy);

    return `Solve this task using the following approach: ${strategyGuidance}

**Task:** ${task}

${context?.language ? `**Language:** ${context.language}\n` : ''}
${context?.constraints?.length ? `**Constraints:**\n${context.constraints.map(c => `- ${c}`).join('\n')}\n` : ''}

**Approach:** ${this.getStrategyDescription(strategy)}

Provide:
1. Complete solution following this approach
2. Pros of this approach
3. Cons/limitations of this approach
4. Complexity assessment (low/medium/high)
5. Performance characteristics (low/medium/high)
6. Maintainability assessment (low/medium/high)
7. Estimated implementation effort

Format your response clearly with these sections.`;
  }

  /**
   * Get strategy description
   */
  private getStrategyDescription(strategy: BranchStrategy): string {
    const descriptions: Record<BranchStrategy, string> = {
      different_algorithms: 'Explore different algorithmic approaches',
      different_libraries: 'Use different libraries/frameworks',
      different_architectures: 'Try different architectural patterns',
      optimistic_vs_cautious: 'Balance between aggressive optimization and safe, conservative approach',
      simple_vs_complex: 'Compare minimal solution vs feature-rich implementation',
    };

    return descriptions[strategy];
  }

  /**
   * Get detailed strategy guidance
   */
  private getStrategyGuidance(strategy: BranchStrategy): string {
    const guidance: Record<BranchStrategy, string> = {
      different_algorithms:
        'Consider multiple algorithmic approaches (e.g., iterative vs recursive, greedy vs dynamic programming, etc.)',
      different_libraries:
        'Evaluate different libraries or frameworks that could solve this (compare their APIs, performance, and ecosystem)',
      different_architectures:
        'Explore different design patterns (e.g., MVC vs MVVM, microservices vs monolith, OOP vs functional)',
      optimistic_vs_cautious:
        'Balance aggressive optimization (performance-first, assumes ideal conditions) vs defensive programming (error handling, edge cases)',
      simple_vs_complex:
        'Compare a minimal viable solution (just core functionality) vs a comprehensive implementation (full features, extensibility)',
    };

    return guidance[strategy];
  }

  /**
   * Extract tradeoffs from solution text
   */
  private async extractTradeoffs(solutionText: string): Promise<ThinkingBranch['tradeoffs']> {
    const prompt = `Extract the tradeoffs from this solution description:

${solutionText}

Provide a JSON object with:
{
  "pros": [list of advantages],
  "cons": [list of disadvantages],
  "complexity": "low" | "medium" | "high",
  "performance": "low" | "medium" | "high",
  "maintainability": "low" | "medium" | "high"
}`;

    try {
      const response = await this.llmProvider.generateText({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 500,
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          pros: parsed.pros ?? [],
          cons: parsed.cons ?? [],
          complexity: parsed.complexity ?? 'medium',
          performance: parsed.performance ?? 'medium',
          maintainability: parsed.maintainability ?? 'medium',
        };
      }
    } catch (error) {
      console.error('Error extracting tradeoffs:', error);
    }

    // Fallback
    return {
      pros: [],
      cons: [],
      complexity: 'medium',
      performance: 'medium',
      maintainability: 'medium',
    };
  }

  /**
   * Rank branches by quality and suitability
   */
  private async rankBranches(task: string, branches: ThinkingBranch[]): Promise<ThinkingBranch[]> {
    const prompt = `Rank these solution approaches for the task: "${task}"

${branches.map((b, i) => `
**Approach ${i + 1}: ${b.description}**
Pros: ${b.tradeoffs.pros.join(', ')}
Cons: ${b.tradeoffs.cons.join(', ')}
Complexity: ${b.tradeoffs.complexity}
Performance: ${b.tradeoffs.performance}
Maintainability: ${b.tradeoffs.maintainability}

Solution:
${b.solution}
`).join('\n---\n')}

Rate each approach from 0-1 considering:
- Correctness and completeness
- Alignment with best practices
- Performance characteristics
- Maintainability and clarity
- Production-readiness

Format as JSON array: [{"approachIndex": 0, "score": 0.85}, ...]`;

    try {
      const response = await this.llmProvider.generateText({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 500,
      });

      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const rankings = JSON.parse(jsonMatch[0]);

        // Add scores to branches
        rankings.forEach((r: any) => {
          if (r.approachIndex < branches.length) {
            branches[r.approachIndex].recommendationScore = r.score;
          }
        });

        // Sort by score
        return branches.sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0));
      }
    } catch (error) {
      console.error('Error ranking branches:', error);
    }

    return branches;
  }

  /**
   * Synthesize best ideas from all branches
   */
  private async synthesizeBranches(
    task: string,
    rankedBranches: ThinkingBranch[]
  ): Promise<string> {
    const prompt = `Synthesize the best solution by combining strengths from these approaches:

**Task:** ${task}

${rankedBranches.map((b, i) => `
**Approach ${i + 1} (Score: ${b.recommendationScore?.toFixed(2) ?? 'N/A'}): ${b.description}**
${b.solution}

Strengths: ${b.tradeoffs.pros.join(', ')}
Weaknesses: ${b.tradeoffs.cons.join(', ')}
`).join('\n---\n')}

Create a synthesized solution that:
1. Takes the best ideas from each approach
2. Minimizes the weaknesses
3. Balances complexity with functionality
4. Provides a production-ready implementation

Explain which ideas came from which approach and why you chose them.`;

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      maxTokens: 2500,
    });

    return response.text;
  }

  /**
   * Generate comparison analysis
   */
  private async generateComparison(
    task: string,
    rankedBranches: ThinkingBranch[]
  ): Promise<string> {
    const prompt = `Provide a detailed comparison of these solution approaches:

**Task:** ${task}

${rankedBranches.map((b, i) => `
**${i + 1}. ${b.description}** (Score: ${b.recommendationScore?.toFixed(2) ?? 'N/A'})
- Complexity: ${b.tradeoffs.complexity}
- Performance: ${b.tradeoffs.performance}
- Maintainability: ${b.tradeoffs.maintainability}
`).join('\n')}

Provide:
1. Summary of key differences
2. When to choose each approach
3. Recommendation with justification
4. Hybrid possibilities

Be concise (2-3 paragraphs).`;

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      maxTokens: 800,
    });

    return response.text;
  }

  /**
   * Suggest strategies based on task type
   */
  suggestStrategies(task: string, context?: { language?: string }): BranchStrategy[] {
    const taskLower = task.toLowerCase();

    const strategies: BranchStrategy[] = [];

    // Algorithm-focused tasks
    if (
      taskLower.includes('algorithm') ||
      taskLower.includes('optimize') ||
      taskLower.includes('sort') ||
      taskLower.includes('search')
    ) {
      strategies.push('different_algorithms');
    }

    // Architecture-focused tasks
    if (
      taskLower.includes('design') ||
      taskLower.includes('architecture') ||
      taskLower.includes('system') ||
      taskLower.includes('structure')
    ) {
      strategies.push('different_architectures');
    }

    // Library/framework choices
    if (
      taskLower.includes('library') ||
      taskLower.includes('framework') ||
      taskLower.includes('tool')
    ) {
      strategies.push('different_libraries');
    }

    // Default: explore complexity tradeoffs
    if (strategies.length === 0) {
      strategies.push('simple_vs_complex', 'optimistic_vs_cautious');
    }

    return strategies;
  }
}
