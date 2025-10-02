/**
 * Reflection Agent - Self-evaluation and iterative refinement
 * Implements the Reflection Pattern for high-quality outputs
 */

import { AgentResponse, TaskInput } from '../types/index.js'
import { LLMManager } from '../llm/index.js'

export interface ReflectionConfig {
  maxIterations: number
  qualityThreshold: number
  model?: string
  temperature?: number
}

export interface Evaluation {
  correctness: number // 0-1
  completeness: number // 0-1
  readability: number // 0-1
  efficiency: number // 0-1
  bestPractices: number // 0-1
  overallQuality: number // Average
  issues: Issue[]
  suggestions: string[]
  hasIssues: boolean
}

export interface Issue {
  type: 'bug' | 'edge-case' | 'style' | 'performance' | 'security'
  severity: 'critical' | 'major' | 'minor'
  description: string
  location?: string
  suggestion?: string
}

export class ReflectionAgent {
  private config: ReflectionConfig
  private llmManager: LLMManager

  constructor(llmManager: LLMManager, config?: Partial<ReflectionConfig>) {
    this.llmManager = llmManager
    this.config = {
      maxIterations: config?.maxIterations ?? 3,
      qualityThreshold: config?.qualityThreshold ?? 0.85,
      model: config?.model,
      temperature: config?.temperature ?? 0.7,
    }
  }

  /**
   * Execute with reflection loop
   */
  async execute(input: TaskInput): Promise<AgentResponse> {
    const startTime = Date.now()
    let output = await this.generate(input)
    let iteration = 0
    const qualities: number[] = []

    while (iteration < this.config.maxIterations) {
      // Evaluate current output
      const evaluation = await this.evaluate(output, input.task)
      qualities.push(evaluation.overallQuality)

      console.log(
        `[Reflection] Iteration ${iteration + 1}: Quality ${evaluation.overallQuality.toFixed(2)}`
      )

      // Check if quality threshold met
      if (evaluation.overallQuality >= this.config.qualityThreshold) {
        console.log(
          `[Reflection] Quality threshold met (${this.config.qualityThreshold})`
        )
        return {
          success: true,
          output,
          metadata: {
            agent: 'reflection',
            pattern: 'reflection',
            iterations: iteration + 1,
            finalQuality: evaluation.overallQuality,
            duration: Date.now() - startTime,
          },
        }
      }

      // Check if no issues found
      if (!evaluation.hasIssues) {
        console.log('[Reflection] No issues found, stopping')
        break
      }

      // Check for diminishing returns
      if (iteration > 0 && evaluation.overallQuality <= qualities[iteration - 1]) {
        console.log('[Reflection] No improvement, stopping')
        break
      }

      // Refine output
      console.log(
        `[Reflection] Refining... (${evaluation.issues.length} issues found)`
      )
      output = await this.refine(output, evaluation, input.task)
      iteration++
    }

    // Final evaluation
    const finalEvaluation = await this.evaluate(output, input.task)

    return {
      success: true,
      output,
      metadata: {
        agent: 'reflection',
        pattern: 'reflection',
        iterations: iteration + 1,
        finalQuality: finalEvaluation.overallQuality,
        duration: Date.now() - startTime,
      },
    }
  }

  /**
   * Generate initial output
   */
  private async generate(input: TaskInput): Promise<string> {
    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content: `You are a coding assistant focused on generating high-quality code.
Consider:
- Correctness and edge cases
- Code readability and maintainability
- Performance and efficiency
- Best practices and patterns

Generate a complete, well-structured solution.`,
          },
          {
            role: 'user',
            content: input.task,
          },
        ],
        model: this.config.model,
        temperature: this.config.temperature,
      },
      'anthropic'
    )

    return response.text
  }

  /**
   * Evaluate output quality
   */
  private async evaluate(output: string, originalTask: string): Promise<Evaluation> {
    const evaluationPrompt = `Critically evaluate this code/solution for the task: "${originalTask}"

Solution:
\`\`\`
${output}
\`\`\`

Analyze across these dimensions:
1. Correctness: Does it work for all inputs? (0-1 score)
2. Completeness: Are all requirements met? (0-1 score)
3. Readability: Is it clear and maintainable? (0-1 score)
4. Efficiency: Are there performance concerns? (0-1 score)
5. Best Practices: Does it follow standards? (0-1 score)

For each issue found, specify:
- Type: bug, edge-case, style, performance, or security
- Severity: critical, major, or minor
- Description: What's wrong
- Suggestion: How to fix it

Respond in JSON format:
{
  "correctness": 0.0-1.0,
  "completeness": 0.0-1.0,
  "readability": 0.0-1.0,
  "efficiency": 0.0-1.0,
  "bestPractices": 0.0-1.0,
  "issues": [
    {
      "type": "bug|edge-case|style|performance|security",
      "severity": "critical|major|minor",
      "description": "...",
      "suggestion": "..."
    }
  ],
  "suggestions": ["overall suggestion 1", "..."]
}`

    try {
      const response = await this.llmManager.generate(
        {
          messages: [
            {
              role: 'system',
              content:
                'You are a code reviewer. Provide thorough, honest evaluation in valid JSON format.',
            },
            {
              role: 'user',
              content: evaluationPrompt,
            },
          ],
          model: this.config.model,
          temperature: 0.3, // Lower temperature for more consistent evaluation
        },
        'anthropic'
      )

      // Parse JSON response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      const evaluation: Evaluation = {
        correctness: parsed.correctness ?? 0.7,
        completeness: parsed.completeness ?? 0.7,
        readability: parsed.readability ?? 0.7,
        efficiency: parsed.efficiency ?? 0.7,
        bestPractices: parsed.bestPractices ?? 0.7,
        overallQuality: 0,
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        hasIssues: false,
      }

      // Calculate overall quality
      evaluation.overallQuality =
        (evaluation.correctness +
          evaluation.completeness +
          evaluation.readability +
          evaluation.efficiency +
          evaluation.bestPractices) /
        5

      evaluation.hasIssues = evaluation.issues.length > 0

      return evaluation
    } catch (error) {
      console.error('[Reflection] Evaluation parsing error:', error)
      // Fallback evaluation
      return {
        correctness: 0.7,
        completeness: 0.7,
        readability: 0.7,
        efficiency: 0.7,
        bestPractices: 0.7,
        overallQuality: 0.7,
        issues: [],
        suggestions: [],
        hasIssues: false,
      }
    }
  }

  /**
   * Refine output based on evaluation
   */
  private async refine(
    output: string,
    evaluation: Evaluation,
    originalTask: string
  ): Promise<string> {
    const issuesText = evaluation.issues
      .map(
        (issue) =>
          `- [${issue.severity.toUpperCase()}] ${issue.description}\n  Fix: ${issue.suggestion}`
      )
      .join('\n')

    const suggestionsText = evaluation.suggestions
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n')

    const refinementPrompt = `Original task: "${originalTask}"

Current solution:
\`\`\`
${output}
\`\`\`

Issues identified:
${issuesText || 'None'}

General suggestions:
${suggestionsText || 'None'}

Quality scores:
- Correctness: ${evaluation.correctness.toFixed(2)}
- Completeness: ${evaluation.completeness.toFixed(2)}
- Readability: ${evaluation.readability.toFixed(2)}
- Efficiency: ${evaluation.efficiency.toFixed(2)}
- Best Practices: ${evaluation.bestPractices.toFixed(2)}

Generate an improved version that addresses all issues while maintaining functionality. Focus on the lowest-scoring dimensions.`

    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content:
              'You are a coding assistant that improves code based on feedback. Maintain the core logic while fixing identified issues.',
          },
          {
            role: 'user',
            content: refinementPrompt,
          },
        ],
        model: this.config.model,
        temperature: this.config.temperature,
      },
      'anthropic'
    )

    return response.text
  }

  /**
   * Get quality breakdown for last execution
   */
  async getQualityReport(output: string, task: string): Promise<Evaluation> {
    return await this.evaluate(output, task)
  }
}
