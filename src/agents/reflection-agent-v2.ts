/**
 * Reflection Agent V2 - Advanced code generation with multi-dimensional analysis
 * Enhanced with language-specific evaluation, test generation, and code smell detection
 */

import { AgentResponse, TaskInput } from '../types/index.js'
import { LLMManager } from '../llm/index.js'

export interface ReflectionConfigV2 {
  maxIterations: number
  qualityThreshold: number
  model?: string
  temperature?: number
  generateTests?: boolean
  generateDocs?: boolean
  strictMode?: boolean // More rigorous evaluation
  targetLanguage?: string
}

export interface CodeEvaluation {
  // Core quality metrics
  correctness: number // 0-1: Logic correctness
  completeness: number // 0-1: Requirements coverage
  readability: number // 0-1: Code clarity
  efficiency: number // 0-1: Performance
  bestPractices: number // 0-1: Standards adherence

  // Advanced metrics
  maintainability: number // 0-1: Easy to modify
  testability: number // 0-1: Easy to test
  security: number // 0-1: Security considerations
  errorHandling: number // 0-1: Error cases covered
  documentation: number // 0-1: Documentation quality

  // Calculated
  overallQuality: number

  // Detailed analysis
  issues: CodeIssue[]
  codeSmells: CodeSmell[]
  suggestions: string[]
  strengths: string[]

  // Language-specific
  languageSpecific?: LanguageAnalysis

  // Meta
  hasIssues: boolean
  hasCriticalIssues: boolean
}

export interface CodeIssue {
  type: 'bug' | 'edge-case' | 'style' | 'performance' | 'security' | 'logic' | 'type-safety'
  severity: 'critical' | 'major' | 'minor' | 'info'
  description: string
  location?: string
  codeSnippet?: string
  suggestion: string
  references?: string[] // Links to docs/standards
}

export interface CodeSmell {
  smell: string // e.g., "Long Method", "God Class", "Duplicate Code"
  description: string
  severity: 'high' | 'medium' | 'low'
  refactoringTip: string
}

export interface LanguageAnalysis {
  language: string
  idiomaticScore: number // How idiomatic the code is (0-1)
  typeUsage?: string // "excellent" | "good" | "needs-improvement"
  frameworkBestPractices?: string[]
  modernFeatures?: string[] // Features used well
  missingFeatures?: string[] // Modern features that could be used
}

export interface TestSuite {
  framework: string
  tests: string
  coverage: string[] // What scenarios are covered
  missing: string[] // What scenarios are missing
}

export interface Documentation {
  summary: string
  functionDocs: string
  usage: string
  examples: string
}

export class ReflectionAgentV2 {
  private config: ReflectionConfigV2
  private llmManager: LLMManager

  constructor(llmManager: LLMManager, config?: Partial<ReflectionConfigV2>) {
    this.llmManager = llmManager
    this.config = {
      maxIterations: config?.maxIterations ?? 3,
      qualityThreshold: config?.qualityThreshold ?? 0.90, // Higher default
      model: config?.model,
      temperature: config?.temperature ?? 0.7,
      generateTests: config?.generateTests ?? true,
      generateDocs: config?.generateDocs ?? true,
      strictMode: config?.strictMode ?? true,
      targetLanguage: config?.targetLanguage,
    }
  }

  /**
   * Execute with advanced reflection loop
   */
  async execute(input: TaskInput): Promise<AgentResponse> {
    const startTime = Date.now()

    // Detect language from task
    const language = this.detectLanguage(input.task) || this.config.targetLanguage || 'typescript'

    // Generate initial code
    let code = await this.generateCode(input, language)
    let iteration = 0
    const qualities: number[] = []
    const evaluations: CodeEvaluation[] = []

    console.log(`[ReflectionV2] Target language: ${language}`)

    while (iteration < this.config.maxIterations) {
      // Comprehensive evaluation
      const evaluation = await this.evaluateCode(code, input.task, language)
      qualities.push(evaluation.overallQuality)
      evaluations.push(evaluation)

      console.log(
        `[ReflectionV2] Iteration ${iteration + 1}: Quality ${(evaluation.overallQuality * 100).toFixed(1)}%`
      )
      console.log(`  - Correctness: ${(evaluation.correctness * 100).toFixed(0)}%`)
      console.log(`  - Security: ${(evaluation.security * 100).toFixed(0)}%`)
      console.log(`  - Maintainability: ${(evaluation.maintainability * 100).toFixed(0)}%`)

      // Check quality threshold
      if (evaluation.overallQuality >= this.config.qualityThreshold) {
        console.log(`[ReflectionV2] Quality threshold met!`)
        break
      }

      // Check for critical issues
      if (evaluation.hasCriticalIssues) {
        console.log(`[ReflectionV2] Critical issues found, refining...`)
      }

      // Check for diminishing returns
      if (iteration > 0 && evaluation.overallQuality <= qualities[iteration - 1] + 0.02) {
        console.log('[ReflectionV2] Minimal improvement, stopping')
        break
      }

      // Refine code
      code = await this.refineCode(code, evaluation, input.task, language)
      iteration++
    }

    // Final evaluation
    const finalEvaluation = evaluations[evaluations.length - 1]

    // Generate output package
    let output = code

    // Add tests if requested
    if (this.config.generateTests) {
      const tests = await this.generateTests(code, input.task, language)
      output += `\n\n// ===== TESTS =====\n${tests.tests}`
    }

    // Add documentation if requested
    if (this.config.generateDocs) {
      const docs = await this.generateDocumentation(code, input.task, language)
      output = `/**\n * ${docs.summary}\n * \n * ${docs.usage}\n */\n\n` + output
      output += `\n\n// ===== USAGE EXAMPLES =====\n${docs.examples}`
    }

    return {
      success: true,
      output,
      metadata: {
        agent: 'reflection-v2',
        pattern: 'reflection',
        iterations: iteration + 1,
        finalQuality: finalEvaluation.overallQuality,
        tokensUsed: 0, // Will be filled by caller
        duration: Date.now() - startTime,
      },
    }
  }

  /**
   * Detect programming language from task
   */
  private detectLanguage(task: string): string | null {
    const taskLower = task.toLowerCase()

    const patterns = [
      { lang: 'typescript', patterns: ['typescript', 'ts ', '.ts', 'type-safe'] },
      { lang: 'javascript', patterns: ['javascript', 'js ', '.js', 'node', 'react', 'vue'] },
      { lang: 'python', patterns: ['python', '.py', 'django', 'flask', 'pandas'] },
      { lang: 'go', patterns: ['golang', 'go ', '.go'] },
      { lang: 'rust', patterns: ['rust', '.rs'] },
      { lang: 'java', patterns: ['java', '.java', 'spring'] },
      { lang: 'cpp', patterns: ['c++', 'cpp', '.cpp'] },
    ]

    for (const { lang, patterns: pats } of patterns) {
      if (pats.some(p => taskLower.includes(p))) {
        return lang
      }
    }

    return null
  }

  /**
   * Generate code with language-specific best practices
   */
  private async generateCode(input: TaskInput, language: string): Promise<string> {
    const languageGuidance = this.getLanguageGuidance(language)

    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content: `You are an expert ${language} developer. Generate production-ready code following these principles:

${languageGuidance}

CRITICAL REQUIREMENTS:
1. Write complete, functional code (not pseudocode)
2. Include comprehensive error handling
3. Add TypeScript types (if applicable) or type hints
4. Follow SOLID principles
5. Consider edge cases and boundary conditions
6. Use modern language features appropriately
7. Write self-documenting code with clear variable names
8. Include input validation
9. Handle async operations properly
10. Consider security implications

Output ONLY the code, no explanations.`,
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

    return this.extractCode(response.text)
  }

  /**
   * Get language-specific guidance
   */
  private getLanguageGuidance(language: string): string {
    const guidance: Record<string, string> = {
      typescript: `- Use strict TypeScript with proper types (no 'any')
- Leverage union types, generics, and type guards
- Use const assertions and readonly where appropriate
- Prefer functional patterns and immutability
- Use async/await over Promise chains
- Implement proper error types (not just Error)`,

      javascript: `- Use ES6+ features (const/let, arrow functions, destructuring)
- Leverage async/await for asynchronous operations
- Use proper error handling with try/catch
- Implement input validation
- Consider using JSDoc for type hints`,

      python: `- Follow PEP 8 style guidelines
- Use type hints (from typing module)
- Implement proper exception handling
- Use context managers (with statement)
- Leverage list/dict comprehensions appropriately
- Use dataclasses or Pydantic for data structures`,

      go: `- Follow Go idioms and conventions
- Use proper error handling (return error)
- Leverage goroutines and channels appropriately
- Use defer for cleanup
- Implement context for cancellation
- Use interfaces for abstraction`,

      rust: `- Leverage ownership and borrowing correctly
- Use Result<T, E> for error handling
- Implement proper trait bounds
- Use pattern matching extensively
- Consider zero-cost abstractions
- Handle Option<T> explicitly`,
    }

    return guidance[language] || '- Follow language best practices and conventions'
  }

  /**
   * Advanced code evaluation
   */
  private async evaluateCode(
    code: string,
    task: string,
    language: string
  ): Promise<CodeEvaluation> {
    const evaluationPrompt = `You are an expert code reviewer specializing in ${language}. Perform a comprehensive analysis.

TASK: "${task}"

CODE:
\`\`\`${language}
${code}
\`\`\`

Evaluate across these dimensions (score 0.0-1.0):

1. CORRECTNESS: Does it solve the problem correctly?
   - Logic errors
   - Edge cases handled
   - Boundary conditions

2. COMPLETENESS: Are all requirements met?
   - All features implemented
   - Error handling
   - Input validation

3. READABILITY: Is the code clear?
   - Variable naming
   - Code structure
   - Comments where needed

4. EFFICIENCY: Performance considerations
   - Time complexity
   - Space complexity
   - Unnecessary operations

5. BEST PRACTICES: Language standards
   - ${language} idioms
   - Design patterns
   - Code organization

6. MAINTAINABILITY: Future-proof code
   - Modularity
   - Coupling/cohesion
   - Testability

7. TESTABILITY: Easy to test
   - Pure functions
   - Dependency injection
   - Test scenarios clear

8. SECURITY: Security considerations
   - Input sanitization
   - SQL injection prevention
   - XSS prevention
   - Authentication/authorization

9. ERROR HANDLING: Robustness
   - Try/catch usage
   - Error propagation
   - Graceful degradation

10. DOCUMENTATION: Code documentation
    - Function documentation
    - Complex logic explained
    - Usage examples

Identify CODE SMELLS:
- Long methods/functions
- God objects/classes
- Duplicate code
- Magic numbers
- Deep nesting
- etc.

Respond in JSON:
{
  "correctness": 0.0-1.0,
  "completeness": 0.0-1.0,
  "readability": 0.0-1.0,
  "efficiency": 0.0-1.0,
  "bestPractices": 0.0-1.0,
  "maintainability": 0.0-1.0,
  "testability": 0.0-1.0,
  "security": 0.0-1.0,
  "errorHandling": 0.0-1.0,
  "documentation": 0.0-1.0,
  "issues": [
    {
      "type": "bug|edge-case|security|performance|style|logic|type-safety",
      "severity": "critical|major|minor|info",
      "description": "...",
      "location": "line X or function Y",
      "suggestion": "...",
      "references": ["https://..."]
    }
  ],
  "codeSmells": [
    {
      "smell": "Long Method",
      "description": "...",
      "severity": "high|medium|low",
      "refactoringTip": "..."
    }
  ],
  "suggestions": ["..."],
  "strengths": ["..."],
  "languageSpecific": {
    "language": "${language}",
    "idiomaticScore": 0.0-1.0,
    "modernFeatures": ["feature1", "..."],
    "missingFeatures": ["feature1", "..."]
  }
}`

    try {
      const response = await this.llmManager.generate(
        {
          messages: [
            {
              role: 'system',
              content: `You are a senior code reviewer. Provide thorough, actionable feedback in valid JSON format. Be strict but fair.`,
            },
            {
              role: 'user',
              content: evaluationPrompt,
            },
          ],
          model: this.config.model,
          temperature: 0.2, // Very low for consistent evaluation
        },
        'anthropic'
      )

      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON in evaluation response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      const evaluation: CodeEvaluation = {
        correctness: parsed.correctness ?? 0.7,
        completeness: parsed.completeness ?? 0.7,
        readability: parsed.readability ?? 0.7,
        efficiency: parsed.efficiency ?? 0.7,
        bestPractices: parsed.bestPractices ?? 0.7,
        maintainability: parsed.maintainability ?? 0.7,
        testability: parsed.testability ?? 0.7,
        security: parsed.security ?? 0.7,
        errorHandling: parsed.errorHandling ?? 0.7,
        documentation: parsed.documentation ?? 0.7,
        overallQuality: 0,
        issues: parsed.issues || [],
        codeSmells: parsed.codeSmells || [],
        suggestions: parsed.suggestions || [],
        strengths: parsed.strengths || [],
        languageSpecific: parsed.languageSpecific,
        hasIssues: false,
        hasCriticalIssues: false,
      }

      // Calculate overall quality (weighted average)
      const weights = this.config.strictMode
        ? {
            correctness: 0.20,
            completeness: 0.15,
            security: 0.15,
            errorHandling: 0.10,
            maintainability: 0.10,
            readability: 0.10,
            testability: 0.10,
            efficiency: 0.05,
            bestPractices: 0.03,
            documentation: 0.02,
          }
        : {
            correctness: 0.25,
            completeness: 0.20,
            readability: 0.15,
            efficiency: 0.15,
            bestPractices: 0.10,
            maintainability: 0.05,
            testability: 0.05,
            security: 0.03,
            errorHandling: 0.02,
            documentation: 0.00,
          }

      evaluation.overallQuality =
        evaluation.correctness * weights.correctness +
        evaluation.completeness * weights.completeness +
        evaluation.readability * weights.readability +
        evaluation.efficiency * weights.efficiency +
        evaluation.bestPractices * weights.bestPractices +
        evaluation.maintainability * weights.maintainability +
        evaluation.testability * weights.testability +
        evaluation.security * weights.security +
        evaluation.errorHandling * weights.errorHandling +
        evaluation.documentation * weights.documentation

      evaluation.hasIssues = evaluation.issues.length > 0
      evaluation.hasCriticalIssues = evaluation.issues.some(
        (i) => i.severity === 'critical'
      )

      return evaluation
    } catch (error) {
      console.error('[ReflectionV2] Evaluation error:', error)
      // Fallback
      return this.getFallbackEvaluation()
    }
  }

  /**
   * Refine code based on comprehensive evaluation
   */
  private async refineCode(
    code: string,
    evaluation: CodeEvaluation,
    task: string,
    language: string
  ): Promise<string> {
    // Prioritize issues by severity
    const criticalIssues = evaluation.issues.filter((i) => i.severity === 'critical')
    const majorIssues = evaluation.issues.filter((i) => i.severity === 'major')
    const minorIssues = evaluation.issues.filter((i) => i.severity === 'minor')

    const issuesText = [
      criticalIssues.length > 0
        ? `CRITICAL ISSUES (must fix):\n${criticalIssues.map((i) => `- ${i.description}\n  Fix: ${i.suggestion}`).join('\n')}`
        : '',
      majorIssues.length > 0
        ? `MAJOR ISSUES:\n${majorIssues.map((i) => `- ${i.description}\n  Fix: ${i.suggestion}`).join('\n')}`
        : '',
      minorIssues.length > 0
        ? `MINOR ISSUES:\n${minorIssues.map((i) => `- ${i.description}`).join('\n')}`
        : '',
    ]
      .filter((s) => s)
      .join('\n\n')

    const codeSmellsText =
      evaluation.codeSmells.length > 0
        ? evaluation.codeSmells
            .map(
              (smell) =>
                `- ${smell.smell}: ${smell.description}\n  Refactor: ${smell.refactoringTip}`
            )
            .join('\n')
        : 'None'

    const scoresText = `
- Correctness: ${(evaluation.correctness * 100).toFixed(0)}% ${evaluation.correctness < 0.8 ? '⚠️' : '✓'}
- Security: ${(evaluation.security * 100).toFixed(0)}% ${evaluation.security < 0.8 ? '⚠️' : '✓'}
- Maintainability: ${(evaluation.maintainability * 100).toFixed(0)}% ${evaluation.maintainability < 0.8 ? '⚠️' : '✓'}
- Error Handling: ${(evaluation.errorHandling * 100).toFixed(0)}% ${evaluation.errorHandling < 0.8 ? '⚠️' : '✓'}`

    const refinementPrompt = `You are refining ${language} code. Original task: "${task}"

CURRENT CODE:
\`\`\`${language}
${code}
\`\`\`

${issuesText}

CODE SMELLS DETECTED:
${codeSmellsText}

QUALITY SCORES:
${scoresText}

STRENGTHS:
${evaluation.strengths.map((s) => `- ${s}`).join('\n')}

IMPROVEMENT SUGGESTIONS:
${evaluation.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

LANGUAGE-SPECIFIC RECOMMENDATIONS:
${evaluation.languageSpecific?.missingFeatures?.length ? `Consider using: ${evaluation.languageSpecific.missingFeatures.join(', ')}` : ''}

Generate an improved version that:
1. FIXES ALL CRITICAL AND MAJOR ISSUES
2. Addresses code smells through refactoring
3. Improves the lowest-scoring dimensions
4. Maintains or enhances strengths
5. Remains fully functional

Output ONLY the improved code, no explanations.`

    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content: `You are an expert ${language} developer focused on code improvement. Maintain functionality while addressing all feedback.`,
          },
          {
            role: 'user',
            content: refinementPrompt,
          },
        ],
        model: this.config.model,
        temperature: 0.6, // Slightly lower for more focused refinement
      },
      'anthropic'
    )

    return this.extractCode(response.text)
  }

  /**
   * Generate comprehensive test suite
   */
  private async generateTests(
    code: string,
    task: string,
    language: string
  ): Promise<TestSuite> {
    const testFramework = this.getTestFramework(language)

    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content: `You are a testing expert. Generate comprehensive tests using ${testFramework}.`,
          },
          {
            role: 'user',
            content: `Generate tests for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Original task: "${task}"

Include tests for:
1. Happy path scenarios
2. Edge cases
3. Error conditions
4. Boundary values
5. Input validation

Use ${testFramework}. Output only the test code.`,
          },
        ],
        model: this.config.model,
        temperature: 0.5,
      },
      'anthropic'
    )

    return {
      framework: testFramework,
      tests: this.extractCode(response.text),
      coverage: ['happy-path', 'edge-cases', 'errors'],
      missing: [],
    }
  }

  /**
   * Generate documentation
   */
  private async generateDocumentation(
    code: string,
    task: string,
    language: string
  ): Promise<Documentation> {
    const response = await this.llmManager.generate(
      {
        messages: [
          {
            role: 'system',
            content: 'Generate clear, concise documentation for code.',
          },
          {
            role: 'user',
            content: `Generate documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Task: "${task}"

Provide:
1. Brief summary (1-2 lines)
2. Usage instructions
3. Code examples

Be concise but complete.`,
          },
        ],
        model: this.config.model,
        temperature: 0.4,
      },
      'anthropic'
    )

    const text = response.text
    return {
      summary: text.split('\n')[0] || 'Generated code solution',
      functionDocs: text,
      usage: 'See examples below',
      examples: text,
    }
  }

  /**
   * Extract code from LLM response (remove markdown, explanations)
   */
  private extractCode(text: string): string {
    // Try to extract code from markdown blocks
    const codeBlockMatch = text.match(/```(?:\w+)?\n([\s\S]*?)```/)
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim()
    }

    // If no code block, try to find code-like content
    const lines = text.split('\n')
    const codeLines = lines.filter(
      (line) =>
        line.trim().length > 0 &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('#') &&
        !line.match(/^(Here|This|The code|I've|Let me)/)
    )

    return codeLines.length > 0 ? codeLines.join('\n') : text
  }

  /**
   * Get test framework for language
   */
  private getTestFramework(language: string): string {
    const frameworks: Record<string, string> = {
      typescript: 'Vitest or Jest',
      javascript: 'Jest or Mocha',
      python: 'pytest',
      go: 'testing package',
      rust: 'built-in test framework',
      java: 'JUnit',
    }
    return frameworks[language] || 'appropriate testing framework'
  }

  /**
   * Fallback evaluation
   */
  private getFallbackEvaluation(): CodeEvaluation {
    return {
      correctness: 0.7,
      completeness: 0.7,
      readability: 0.7,
      efficiency: 0.7,
      bestPractices: 0.7,
      maintainability: 0.7,
      testability: 0.7,
      security: 0.7,
      errorHandling: 0.7,
      documentation: 0.7,
      overallQuality: 0.7,
      issues: [],
      codeSmells: [],
      suggestions: [],
      strengths: [],
      hasIssues: false,
      hasCriticalIssues: false,
    }
  }
}
