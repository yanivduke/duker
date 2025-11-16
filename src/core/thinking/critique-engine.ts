/**
 * Critique Engine
 *
 * Self-evaluation system that analyzes solutions and reasoning chains.
 * Provides multi-dimensional quality assessment and identifies areas for improvement.
 */

import { BaseLLMProvider } from '../../llm/base-provider';
import { CritiqueResult, ThinkingChain } from './types';

export class CritiqueEngine {
  constructor(private llmProvider: BaseLLMProvider) {}

  /**
   * Perform comprehensive critique of a solution
   */
  async critiqueSolution(
    task: string,
    solution: string,
    context?: {
      language?: string;
      previousCritique?: CritiqueResult;
      thinkingChain?: ThinkingChain;
      codebaseContext?: string;
    }
  ): Promise<CritiqueResult> {
    const prompt = this.buildCritiquePrompt(task, solution, context);

    const response = await this.llmProvider.generateText({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent evaluation
      maxTokens: 2000,
    });

    return this.parseCritiqueResponse(response.text, context?.previousCritique);
  }

  /**
   * Build the critique prompt
   */
  private buildCritiquePrompt(
    task: string,
    solution: string,
    context?: {
      language?: string;
      previousCritique?: CritiqueResult;
      thinkingChain?: ThinkingChain;
      codebaseContext?: string;
    }
  ): string {
    let prompt = `You are an expert code reviewer and critical thinker. Your task is to thoroughly evaluate the following solution.

**Task:**
${task}

**Solution:**
${solution}

${context?.language ? `**Language:** ${context.language}\n` : ''}

${context?.codebaseContext ? `**Codebase Context:**\n${context.codebaseContext}\n` : ''}

${context?.previousCritique ? `**Previous Critique:**\nLast quality score: ${context.previousCritique.solutionQuality.toFixed(2)}
Previous issues: ${context.previousCritique.criticalIssues.join(', ')}\n` : ''}

Please provide a comprehensive critique in the following structured format:

## Logical Soundness
- **Logical Coherence** (0-1): Are there any contradictions or logical errors?
- **Assumptions Validity** (0-1): Are assumptions well-justified?

## Completeness
- **Coverage Score** (0-1): Are all aspects of the task addressed?
- **Edge Cases** (0-1): Are edge cases considered and handled?

## Quality
- **Solution Quality** (0-1): Overall quality of the solution
- **Best Practices** (0-1): Adherence to industry standards and best practices

## Meta-Cognition
- **Uncertainty Areas**: What aspects are uncertain or ambiguous?
- **Missing Information**: What information would improve the solution?
- **Alternative Approaches**: What other ways could solve this problem?

## Action Items
- **Needs More Research**: Should we search for more information? (yes/no)
- **Needs Codebase Context**: Should we examine existing code? (yes/no)
- **Needs External Validation**: Should we verify with external sources? (yes/no)
- **Research Queries**: If research needed, what should we search for?

## Overall Assessment
- **Overall Confidence** (0-1): How confident are you in this solution?
- **Critical Issues**: List any critical problems
- **Suggestions**: List specific improvements

Format your response as JSON with these exact keys:
{
  "logicalCoherence": <number>,
  "assumptionsValid": <number>,
  "coverageScore": <number>,
  "edgeCasesConsidered": <number>,
  "solutionQuality": <number>,
  "bestPractices": <number>,
  "uncertaintyAreas": [<strings>],
  "missingInformation": [<strings>],
  "alternativeApproaches": [<strings>],
  "needsMoreResearch": <boolean>,
  "needsCodebaseContext": <boolean>,
  "needsExternalValidation": <boolean>,
  "researchQueries": [<strings>],
  "overallConfidence": <number>,
  "criticalIssues": [<strings>],
  "suggestions": [<strings>]
}`;

    return prompt;
  }

  /**
   * Parse the LLM response into a CritiqueResult
   */
  private parseCritiqueResponse(
    response: string,
    previousCritique?: CritiqueResult
  ): CritiqueResult {
    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in critique response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const result: CritiqueResult = {
        logicalCoherence: this.clamp(parsed.logicalCoherence ?? 0.5, 0, 1),
        assumptionsValid: this.clamp(parsed.assumptionsValid ?? 0.5, 0, 1),
        coverageScore: this.clamp(parsed.coverageScore ?? 0.5, 0, 1),
        edgeCasesConsidered: this.clamp(parsed.edgeCasesConsidered ?? 0.5, 0, 1),
        solutionQuality: this.clamp(parsed.solutionQuality ?? 0.5, 0, 1),
        bestPractices: this.clamp(parsed.bestPractices ?? 0.5, 0, 1),
        uncertaintyAreas: parsed.uncertaintyAreas ?? [],
        missingInformation: parsed.missingInformation ?? [],
        alternativeApproaches: parsed.alternativeApproaches ?? [],
        needsMoreResearch: parsed.needsMoreResearch ?? false,
        needsCodebaseContext: parsed.needsCodebaseContext ?? false,
        needsExternalValidation: parsed.needsExternalValidation ?? false,
        researchQueries: parsed.researchQueries ?? [],
        overallConfidence: this.clamp(parsed.overallConfidence ?? 0.5, 0, 1),
        criticalIssues: parsed.criticalIssues ?? [],
        suggestions: parsed.suggestions ?? [],
      };

      // Calculate improvement if previous critique exists
      if (previousCritique) {
        result.previousScore = previousCritique.solutionQuality;
        result.improvement = result.solutionQuality - previousCritique.solutionQuality;
      }

      return result;
    } catch (error) {
      console.error('Error parsing critique response:', error);
      // Return a default critique on parse failure
      return this.getDefaultCritique();
    }
  }

  /**
   * Quick critique focused on identifying flaws
   */
  async identifyFlaws(
    solution: string,
    context?: { language?: string; task?: string }
  ): Promise<string[]> {
    const prompt = `Identify critical flaws in this ${context?.language || 'code'} solution:

${context?.task ? `Task: ${context.task}\n` : ''}

Solution:
${solution}

List only critical issues (security, correctness, performance). Be concise.`;

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 500,
    });

    return response.text
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => line.replace(/^[-*•]\s*/, '').trim());
  }

  /**
   * Suggest specific improvements based on critique
   */
  async suggestImprovements(critique: CritiqueResult, solution: string): Promise<string[]> {
    if (critique.criticalIssues.length === 0 && critique.solutionQuality > 0.9) {
      return ['Solution is high quality. Minor refinements possible.'];
    }

    const prompt = `Given this solution and identified issues, suggest specific, actionable improvements:

**Critical Issues:**
${critique.criticalIssues.join('\n')}

**General Suggestions:**
${critique.suggestions.join('\n')}

**Solution:**
${solution}

Provide 3-5 specific, actionable improvements. Be concrete and technical.`;

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      maxTokens: 800,
    });

    return response.text
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => line.replace(/^[-*•]\d+\.\s*/, '').trim());
  }

  /**
   * Compare multiple alternative solutions
   */
  async compareAlternatives(
    task: string,
    alternatives: Array<{ id: string; solution: string; description: string }>
  ): Promise<Array<{ id: string; score: number; pros: string[]; cons: string[] }>> {
    const prompt = `Compare these alternative solutions for the task: "${task}"

${alternatives.map((alt, i) => `
**Alternative ${i + 1}: ${alt.description}**
${alt.solution}
`).join('\n')}

For each alternative, provide:
1. Quality score (0-1)
2. Pros (3-5 points)
3. Cons (3-5 points)

Format as JSON array:
[
  {
    "alternativeIndex": <number>,
    "score": <number>,
    "pros": [<strings>],
    "cons": [<strings>]
  }
]`;

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1500,
    });

    try {
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any, index: number) => ({
        id: alternatives[item.alternativeIndex ?? index]?.id ?? alternatives[index].id,
        score: this.clamp(item.score ?? 0.5, 0, 1),
        pros: item.pros ?? [],
        cons: item.cons ?? [],
      }));
    } catch (error) {
      console.error('Error parsing alternatives comparison:', error);
      return alternatives.map(alt => ({
        id: alt.id,
        score: 0.5,
        pros: [],
        cons: [],
      }));
    }
  }

  /**
   * Analyze if thinking chain shows circular reasoning
   */
  detectCircularReasoning(chain: ThinkingChain): boolean {
    // Look for repeated content patterns in reasoning steps
    const reasoningSteps = chain.steps.filter(s => s.type === 'reasoning');
    if (reasoningSteps.length < 3) return false;

    const recentSteps = reasoningSteps.slice(-5);
    const contentSet = new Set<string>();

    for (const step of recentSteps) {
      const normalized = step.content.toLowerCase().replace(/\s+/g, ' ').trim();
      if (contentSet.has(normalized)) {
        return true; // Found exact repeat
      }
      contentSet.add(normalized);
    }

    return false;
  }

  /**
   * Calculate quality trend across cycles
   */
  calculateQualityTrend(critiques: CritiqueResult[]): 'improving' | 'declining' | 'stable' {
    if (critiques.length < 2) return 'stable';

    const recentScores = critiques.slice(-3).map(c => c.solutionQuality);
    const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

    const earlierScores = critiques.slice(0, -3).map(c => c.solutionQuality);
    if (earlierScores.length === 0) return 'stable';

    const avgEarlier = earlierScores.reduce((a, b) => a + b, 0) / earlierScores.length;

    const improvement = avgRecent - avgEarlier;
    if (improvement > 0.05) return 'improving';
    if (improvement < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Clamp value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Get default critique for fallback scenarios
   */
  private getDefaultCritique(): CritiqueResult {
    return {
      logicalCoherence: 0.5,
      assumptionsValid: 0.5,
      coverageScore: 0.5,
      edgeCasesConsidered: 0.5,
      solutionQuality: 0.5,
      bestPractices: 0.5,
      uncertaintyAreas: ['Unable to perform detailed analysis'],
      missingInformation: [],
      alternativeApproaches: [],
      needsMoreResearch: false,
      needsCodebaseContext: false,
      needsExternalValidation: false,
      overallConfidence: 0.3,
      criticalIssues: [],
      suggestions: ['Retry critique with more context'],
    };
  }
}
