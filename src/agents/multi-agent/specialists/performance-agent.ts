/**
 * Performance Specialist Agent
 * Handles performance optimization, profiling, and bottleneck detection
 */

import { LLMManager } from '../../../llm/index.js'
import { BaseSpecialistAgent } from '../base-specialist.js'
import { SpecializedTask, SpecialistResult } from '../types.js'

export class PerformanceAgent extends BaseSpecialistAgent {
  constructor(llmManager: LLMManager) {
    super(llmManager, 'performance', [
      { name: 'profiling', description: 'Profile code performance characteristics' },
      { name: 'optimization', description: 'Optimize code for better performance' },
      { name: 'caching-strategy', description: 'Design caching strategies' },
      { name: 'bottleneck-detection', description: 'Identify performance bottlenecks' },
    ])
  }

  protected getSystemPrompt(): string {
    return `You are a Performance Specialist Agent with expertise in:
- Performance profiling and analysis
- Algorithm complexity (time and space)
- Code optimization techniques
- Caching strategies (memory, disk, CDN)
- Database query optimization
- Async/await and concurrency patterns
- Resource management (memory leaks, CPU usage)
- Load testing and scalability

Analyze code from a performance perspective. Identify bottlenecks,
suggest optimizations, and design scalable solutions.

When analyzing:
1. Identify time complexity (O(n), O(n²), etc.)
2. Check for unnecessary loops or operations
3. Review database queries and N+1 problems
4. Identify memory leaks or excessive allocations
5. Check for blocking operations
6. Review caching opportunities

Provide performance assessments with:
- Current performance characteristics
- Bottleneck identification
- Optimization recommendations with code examples
- Expected performance improvements
- Trade-offs and considerations`
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
        aspectsAnalyzed: [
          'Time complexity',
          'Space complexity',
          'Database queries',
          'Caching opportunities',
          'Async patterns',
          'Memory usage',
        ],
      },
    }
  }

  /**
   * Specific performance analysis
   */
  async analyzePerformance(code: string): Promise<string> {
    return await this.generateResponse(
      {
        id: 'performance-analysis',
        description: 'Analyze code performance and identify bottlenecks',
        context: { code },
      },
      'Focus on algorithmic complexity, database queries, and optimization opportunities.'
    )
  }
}
