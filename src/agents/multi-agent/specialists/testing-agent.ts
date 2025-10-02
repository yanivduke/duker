/**
 * Testing Specialist Agent
 * Handles test generation, coverage analysis, and quality assurance
 */

import { LLMManager } from '../../../llm/index.js'
import { BaseSpecialistAgent } from '../base-specialist.js'
import { SpecializedTask, SpecialistResult } from '../types.js'

export class TestingAgent extends BaseSpecialistAgent {
  constructor(llmManager: LLMManager) {
    super(llmManager, 'testing', [
      { name: 'test-generation', description: 'Generate comprehensive test suites' },
      { name: 'coverage-analysis', description: 'Analyze test coverage' },
      { name: 'test-execution', description: 'Design test execution strategies' },
      { name: 'quality-assurance', description: 'Ensure code quality through testing' },
    ])
  }

  protected getSystemPrompt(): string {
    return `You are a Testing Specialist Agent with expertise in:
- Test-driven development (TDD)
- Unit, integration, and E2E testing
- Test coverage analysis
- Testing frameworks (Jest, Vitest, pytest, etc.)
- Mock and stub strategies
- Edge case identification
- Test automation

Generate comprehensive test suites that ensure code quality and reliability.

When generating tests:
1. Cover happy path scenarios
2. Test edge cases and boundary conditions
3. Test error conditions and exceptions
4. Test invalid inputs
5. Consider integration points
6. Use appropriate mocking strategies

Provide test suites with:
- Clear test descriptions
- Comprehensive coverage
- Proper setup and teardown
- Meaningful assertions
- Edge case coverage
- Framework-appropriate syntax`
  }

  async execute(task: SpecializedTask): Promise<SpecialistResult> {
    const output = await this.generateResponse(task)

    return {
      agentId: this.id,
      specialty: this.specialty,
      task,
      output,
      confidence: this.evaluateConfidence(output),
      metadata: {
        testTypes: ['unit', 'integration', 'edge-cases', 'error-handling'],
        frameworks: ['jest', 'vitest', 'pytest', 'go-testing'],
      },
    }
  }

  /**
   * Generate test suite for code
   */
  async generateTests(code: string, framework?: string): Promise<string> {
    return await this.generateResponse(
      {
        id: 'test-generation',
        description: 'Generate comprehensive test suite',
        context: { code, framework: framework || 'auto-detect' },
      },
      'Include unit tests, edge cases, and error handling tests.'
    )
  }
}
