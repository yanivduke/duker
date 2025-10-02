# Reflection Pattern Specification

## Overview

The Reflection Pattern enables agents to self-evaluate and iteratively refine their outputs. This pattern is essential for tasks requiring high quality, accuracy, or when the first attempt may be suboptimal.

## Core Concept

```
Generate → Evaluate → Refine → Re-evaluate → Complete
```

An agent produces output, critically analyzes it, identifies issues, refines the output, and repeats until quality criteria are met.

## Architecture

```typescript
interface ReflectionAgent {
  generate(input: TaskInput): Promise<Output>
  evaluate(output: Output): Promise<Evaluation>
  refine(output: Output, evaluation: Evaluation): Promise<Output>
  shouldContinue(iteration: number, evaluation: Evaluation): boolean
  execute(input: TaskInput): Promise<Output>
}
```

## Process Flow

### Step 1: Initial Generation
```typescript
const initialOutput = await llm.generate({
  prompt: userInput,
  model: config.model
})
```

### Step 2: Self-Evaluation
```typescript
const evaluation = await llm.evaluate({
  prompt: `Critically evaluate this output:
    ${initialOutput}

    Consider:
    - Correctness
    - Completeness
    - Code quality
    - Edge cases
    - Best practices

    Provide specific issues and suggestions.`,
  model: config.model
})
```

### Step 3: Refinement
```typescript
const refinedOutput = await llm.refine({
  prompt: `Original output: ${initialOutput}

    Issues found: ${evaluation.issues}

    Generate improved version addressing all issues.`,
  model: config.model
})
```

### Step 4: Iteration Decision
```typescript
const shouldContinue =
  iteration < maxIterations &&
  evaluation.quality < qualityThreshold &&
  evaluation.hasIssues
```

## Use Cases

### Primary Use Cases
- **Code Review**: Self-review generated code for bugs/improvements
- **Documentation**: Iteratively improve clarity and completeness
- **Complex Algorithms**: Refine logic and edge case handling
- **Debugging**: Analyze and improve fix quality
- **Refactoring**: Iteratively improve code structure

### When to Use Reflection
- Output quality is critical
- First attempt may miss edge cases
- Task benefits from review/critique
- Time allows for multiple iterations
- Correctness > speed

### When NOT to Use Reflection
- Simple, straightforward tasks
- Time-sensitive requests
- Output quality is already high
- Diminishing returns on improvement

## Configuration

```typescript
interface ReflectionConfig {
  maxIterations: number        // Default: 3
  qualityThreshold: number      // 0-1 scale, Default: 0.85
  evaluationCriteria: string[]  // Custom criteria
  model: string                 // LLM model for reflection
  temperature: number           // Default: 0.7
}
```

## Evaluation Criteria

### Code Quality Metrics
```typescript
interface CodeEvaluation {
  correctness: number      // 0-1: Logic correctness
  completeness: number     // 0-1: Handles all cases
  readability: number      // 0-1: Code clarity
  efficiency: number       // 0-1: Performance
  bestPractices: number    // 0-1: Follows standards
  issues: Issue[]
  suggestions: string[]
  overallQuality: number   // Average of above
}
```

### Issue Types
```typescript
type Issue = {
  type: 'bug' | 'edge-case' | 'style' | 'performance' | 'security'
  severity: 'critical' | 'major' | 'minor'
  description: string
  location?: string
  suggestion?: string
}
```

## Prompting Strategy

### Generation Prompt Template
```typescript
const generationPrompt = `
Task: ${userInput}

Context: ${context}

Generate a high-quality solution. Consider:
- Correctness and edge cases
- Code readability and maintainability
- Performance and efficiency
- Best practices and patterns

Output:
`
```

### Evaluation Prompt Template
```typescript
const evaluationPrompt = `
Critically evaluate this code:

\`\`\`
${output}
\`\`\`

Analyze:
1. Correctness: Does it work for all inputs?
2. Edge Cases: What scenarios might fail?
3. Code Quality: Is it readable and maintainable?
4. Best Practices: Does it follow standards?
5. Performance: Are there efficiency concerns?

Provide:
- List of specific issues (with severity)
- Concrete suggestions for improvement
- Overall quality score (0-1)

Format as JSON:
{
  "issues": [...],
  "suggestions": [...],
  "scores": {...},
  "overallQuality": 0.0
}
`
```

### Refinement Prompt Template
```typescript
const refinementPrompt = `
Original code:
\`\`\`
${originalOutput}
\`\`\`

Issues identified:
${issues.map(i => `- ${i.description}`).join('\n')}

Suggestions:
${suggestions.map(s => `- ${s}`).join('\n')}

Generate an improved version that addresses all issues while maintaining functionality.

Improved code:
`
```

## Implementation Example

```typescript
class ReflectionAgent {
  constructor(private config: ReflectionConfig) {}

  async execute(input: TaskInput): Promise<Output> {
    let output = await this.generate(input)
    let iteration = 0

    while (iteration < this.config.maxIterations) {
      const evaluation = await this.evaluate(output)

      if (evaluation.overallQuality >= this.config.qualityThreshold) {
        return {
          output,
          iterations: iteration + 1,
          finalQuality: evaluation.overallQuality
        }
      }

      if (!evaluation.hasIssues) {
        break
      }

      output = await this.refine(output, evaluation)
      iteration++
    }

    return {
      output,
      iterations: iteration + 1,
      finalQuality: await this.evaluate(output).overallQuality
    }
  }

  private async generate(input: TaskInput): Promise<Output> {
    return await this.llm.generate({
      prompt: this.buildGenerationPrompt(input),
      model: this.config.model
    })
  }

  private async evaluate(output: Output): Promise<Evaluation> {
    const result = await this.llm.generate({
      prompt: this.buildEvaluationPrompt(output),
      model: this.config.model,
      responseFormat: 'json'
    })

    return JSON.parse(result)
  }

  private async refine(
    output: Output,
    evaluation: Evaluation
  ): Promise<Output> {
    return await this.llm.generate({
      prompt: this.buildRefinementPrompt(output, evaluation),
      model: this.config.model
    })
  }
}
```

## Optimization Strategies

### Early Termination
```typescript
// Stop if quality is good enough
if (evaluation.overallQuality >= 0.95) {
  return output
}

// Stop if no improvement
if (evaluation.overallQuality <= previousQuality) {
  return output
}
```

### Targeted Refinement
```typescript
// Only refine specific issues
const criticalIssues = evaluation.issues.filter(
  i => i.severity === 'critical' || i.severity === 'major'
)

if (criticalIssues.length === 0) {
  return output
}
```

### Parallel Evaluation
```typescript
// Evaluate multiple aspects in parallel
const [correctness, performance, style] = await Promise.all([
  evaluateCorrectness(output),
  evaluatePerformance(output),
  evaluateStyle(output)
])
```

## Metrics & Monitoring

Track reflection effectiveness:
```typescript
interface ReflectionMetrics {
  averageIterations: number
  qualityImprovement: number  // First vs final quality
  successRate: number         // % reaching threshold
  timePerIteration: number
  mostCommonIssues: IssueType[]
}
```

## Example Scenarios

### Scenario 1: Code Generation with Reflection
```
User: "Write a function to validate email addresses"

Iteration 1:
- Generate basic regex validation
- Evaluate: Missing edge cases (internationalization, special chars)
- Quality: 0.65

Iteration 2:
- Refine with comprehensive regex
- Evaluate: Good but could use better error messages
- Quality: 0.80

Iteration 3:
- Add descriptive error messages
- Evaluate: Complete and robust
- Quality: 0.92 ✓
```

### Scenario 2: Algorithm Optimization
```
User: "Optimize this sorting function"

Iteration 1:
- Analyze and suggest O(n log n) approach
- Evaluate: Correct but edge cases missing
- Quality: 0.70

Iteration 2:
- Add edge case handling (empty, single element)
- Evaluate: Good but memory inefficient
- Quality: 0.80

Iteration 3:
- Optimize memory usage with in-place sorting
- Evaluate: Efficient and robust
- Quality: 0.90 ✓
```

## Integration with Other Patterns

### Reflection + Tool Use
```typescript
// Reflect on tool outputs
const toolOutput = await toolAgent.execute(input)
const evaluation = await reflectionAgent.evaluate(toolOutput)
if (evaluation.quality < threshold) {
  // Refine tool usage strategy
}
```

### Reflection + Planning
```typescript
// Reflect on plan quality before execution
const plan = await planningAgent.createPlan(input)
const planEval = await reflectionAgent.evaluate(plan)
if (planEval.hasIssues) {
  plan = await planningAgent.refinePlan(plan, planEval)
}
```

## Best Practices

1. **Set Appropriate Thresholds**: Balance quality vs speed
2. **Use Structured Evaluation**: JSON format for parsing
3. **Limit Iterations**: Prevent infinite loops (max 3-5)
4. **Track Metrics**: Monitor improvement over iterations
5. **Graceful Degradation**: Return best attempt if threshold not met
6. **Cost Awareness**: Each iteration costs tokens/time
7. **Caching**: Cache evaluations for identical outputs

## Anti-Patterns to Avoid

- Over-iteration on simple tasks
- Vague evaluation criteria
- Ignoring diminishing returns
- Not tracking quality improvements
- Reflection on non-deterministic outputs
