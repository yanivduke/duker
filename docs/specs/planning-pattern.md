# Planning Pattern Specification

## Overview

The Planning Pattern (Orchestrator-Workers) decomposes complex tasks into manageable subtasks, executes them systematically, and synthesizes results. This pattern is essential for multi-step projects and complex feature implementations.

## Core Concept

```
Task → Analyze → Plan → Execute Subtasks → Synthesize → Result
```

A planning agent breaks down complex tasks into specific subtasks, delegates to worker agents, and combines results into a cohesive solution.

## Architecture

```typescript
interface PlanningAgent {
  analyze(input: TaskInput): Promise<TaskAnalysis>
  createPlan(analysis: TaskAnalysis): Promise<Plan>
  executeSubtasks(plan: Plan): Promise<SubtaskResult[]>
  synthesize(results: SubtaskResult[]): Promise<Response>
  execute(input: TaskInput): Promise<Response>
}

interface Plan {
  approach: string
  subtasks: Subtask[]
  dependencies: DependencyGraph
  estimatedTime?: number
}

interface Subtask {
  id: string
  description: string
  type: SubtaskType
  agentType: AgentType
  dependencies: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
}
```

## Planning Process

### Step 1: Task Analysis

```typescript
interface TaskAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'very-complex'
  domain: string[]
  requirements: string[]
  constraints: string[]
  successCriteria: string[]
  estimatedSubtasks: number
}

async function analyzeTask(input: TaskInput): Promise<TaskAnalysis> {
  const prompt = `
    Analyze this task:
    "${input.task}"

    Determine:
    1. Complexity level
    2. Technical domains involved
    3. Key requirements
    4. Constraints and limitations
    5. Success criteria
    6. Estimated number of subtasks needed

    Provide analysis as JSON.
  `

  return await llm.generate({ prompt, format: 'json' })
}
```

### Step 2: Plan Creation

```typescript
async function createPlan(analysis: TaskAnalysis): Promise<Plan> {
  const prompt = `
    Task: ${analysis.task}
    Complexity: ${analysis.complexity}

    Create a detailed execution plan:

    1. Choose an approach (explain reasoning)
    2. Break down into 3-7 concrete subtasks
    3. For each subtask specify:
       - Description (specific and actionable)
       - Type (research, implementation, testing, etc.)
       - Agent type (tool, reflection, react, etc.)
       - Dependencies (which subtasks must complete first)
       - Priority level

    Format as JSON:
    {
      "approach": "string",
      "reasoning": "string",
      "subtasks": [...]
    }
  `

  return await llm.generate({ prompt, format: 'json' })
}
```

### Step 3: Dependency Resolution

```typescript
interface DependencyGraph {
  nodes: Map<string, Subtask>
  edges: Map<string, string[]>
}

function buildDependencyGraph(subtasks: Subtask[]): DependencyGraph {
  const graph: DependencyGraph = {
    nodes: new Map(),
    edges: new Map()
  }

  subtasks.forEach(task => {
    graph.nodes.set(task.id, task)
    graph.edges.set(task.id, task.dependencies)
  })

  return graph
}

function getExecutionOrder(graph: DependencyGraph): string[][] {
  // Topological sort to determine execution waves
  const waves: string[][] = []
  const completed = new Set<string>()

  while (completed.size < graph.nodes.size) {
    const wave = Array.from(graph.nodes.keys()).filter(id => {
      if (completed.has(id)) return false
      const deps = graph.edges.get(id) || []
      return deps.every(dep => completed.has(dep))
    })

    if (wave.length === 0) {
      throw new Error('Circular dependency detected')
    }

    waves.push(wave)
    wave.forEach(id => completed.add(id))
  }

  return waves
}
```

### Step 4: Subtask Execution

```typescript
async function executeSubtasks(plan: Plan): Promise<SubtaskResult[]> {
  const graph = buildDependencyGraph(plan.subtasks)
  const waves = getExecutionOrder(graph)
  const results = new Map<string, SubtaskResult>()

  // Execute in waves (parallel within wave)
  for (const wave of waves) {
    const waveResults = await Promise.all(
      wave.map(async taskId => {
        const subtask = graph.nodes.get(taskId)!
        const agent = selectAgent(subtask.agentType)

        // Provide previous results as context
        const context = subtask.dependencies.map(
          depId => results.get(depId)
        )

        return await agent.execute({
          task: subtask.description,
          context
        })
      })
    )

    wave.forEach((taskId, index) => {
      results.set(taskId, waveResults[index])
    })
  }

  return Array.from(results.values())
}
```

### Step 5: Result Synthesis

```typescript
async function synthesize(
  results: SubtaskResult[],
  originalTask: string
): Promise<Response> {
  const prompt = `
    Original Task: ${originalTask}

    Subtask Results:
    ${results.map((r, i) => `
      ${i + 1}. ${r.subtask}
      Result: ${r.output}
      Success: ${r.success}
    `).join('\n')}

    Synthesize these results into a cohesive solution:
    1. Combine all outputs logically
    2. Ensure consistency across results
    3. Address the original task completely
    4. Provide a clear, actionable response
  `

  return await llm.generate({ prompt })
}
```

## Subtask Types

```typescript
type SubtaskType =
  | 'research'        // Gather information
  | 'analysis'        // Understand existing code
  | 'design'          // Create architecture/design
  | 'implementation'  // Write code
  | 'testing'         // Write/run tests
  | 'documentation'   // Create docs
  | 'validation'      // Verify correctness
  | 'optimization'    // Improve performance

const subtaskAgentMapping: Record<SubtaskType, AgentType> = {
  research: 'tool',           // Web search, RAG
  analysis: 'react',          // Iterative exploration
  design: 'reflection',       // Iterative refinement
  implementation: 'tool',     // Code generation
  testing: 'tool',            // Test execution
  documentation: 'reflection',// Quality writing
  validation: 'react',        // Verification loop
  optimization: 'reflection'  // Iterative improvement
}
```

## Plan Templates

### Feature Implementation Template

```typescript
const featureImplementationPlan = {
  approach: 'incremental-development',
  subtasks: [
    {
      id: 'research',
      description: 'Research best practices and existing implementations',
      type: 'research',
      agentType: 'tool',
      dependencies: [],
      priority: 'high'
    },
    {
      id: 'analyze',
      description: 'Analyze existing codebase and integration points',
      type: 'analysis',
      agentType: 'react',
      dependencies: [],
      priority: 'high'
    },
    {
      id: 'design',
      description: 'Design architecture and component structure',
      type: 'design',
      agentType: 'reflection',
      dependencies: ['research', 'analyze'],
      priority: 'critical'
    },
    {
      id: 'implement',
      description: 'Implement core functionality',
      type: 'implementation',
      agentType: 'tool',
      dependencies: ['design'],
      priority: 'critical'
    },
    {
      id: 'test',
      description: 'Write and run tests',
      type: 'testing',
      agentType: 'tool',
      dependencies: ['implement'],
      priority: 'high'
    },
    {
      id: 'document',
      description: 'Create documentation and comments',
      type: 'documentation',
      agentType: 'reflection',
      dependencies: ['implement'],
      priority: 'medium'
    }
  ]
}
```

### Debugging Template

```typescript
const debuggingPlan = {
  approach: 'systematic-investigation',
  subtasks: [
    {
      id: 'reproduce',
      description: 'Reproduce the bug and gather error information',
      type: 'analysis',
      agentType: 'react',
      dependencies: [],
      priority: 'critical'
    },
    {
      id: 'locate',
      description: 'Identify the root cause in the codebase',
      type: 'analysis',
      agentType: 'react',
      dependencies: ['reproduce'],
      priority: 'critical'
    },
    {
      id: 'fix',
      description: 'Implement the fix',
      type: 'implementation',
      agentType: 'tool',
      dependencies: ['locate'],
      priority: 'critical'
    },
    {
      id: 'verify',
      description: 'Verify the fix resolves the issue',
      type: 'validation',
      agentType: 'react',
      dependencies: ['fix'],
      priority: 'critical'
    }
  ]
}
```

## Plan Adaptation

### Dynamic Re-planning

```typescript
async function executeWithAdaptation(plan: Plan): Promise<Response> {
  const results: SubtaskResult[] = []

  for (const subtask of plan.subtasks) {
    const result = await executeSubtask(subtask, results)
    results.push(result)

    // Check if plan needs adjustment
    if (result.requiresReplanning) {
      console.log('Re-planning based on new information...')

      const remainingTasks = plan.subtasks.slice(results.length)
      const newPlan = await replan({
        originalPlan: plan,
        completedResults: results,
        remainingTasks,
        newContext: result.newContext
      })

      // Update plan with new subtasks
      plan.subtasks = [
        ...plan.subtasks.slice(0, results.length),
        ...newPlan.subtasks
      ]
    }
  }

  return synthesize(results, plan.originalTask)
}
```

## Parallel Execution Strategies

### Wave-Based Execution

```typescript
// Execute independent subtasks in parallel
async function executeWave(wave: Subtask[]): Promise<SubtaskResult[]> {
  console.log(`Executing wave of ${wave.length} parallel tasks...`)

  return await Promise.all(
    wave.map(task => executeSubtask(task))
  )
}
```

### Priority-Based Execution

```typescript
// Execute critical tasks first
function prioritizeTasks(tasks: Subtask[]): Subtask[] {
  const priority = {
    'critical': 0,
    'high': 1,
    'medium': 2,
    'low': 3
  }

  return tasks.sort((a, b) =>
    priority[a.priority] - priority[b.priority]
  )
}
```

## Progress Tracking

```typescript
interface PlanProgress {
  totalSubtasks: number
  completed: number
  inProgress: number
  pending: number
  failed: number
  estimatedTimeRemaining?: number
}

function trackProgress(
  plan: Plan,
  results: SubtaskResult[]
): PlanProgress {
  return {
    totalSubtasks: plan.subtasks.length,
    completed: results.filter(r => r.success).length,
    inProgress: 1, // Current subtask
    pending: plan.subtasks.length - results.length - 1,
    failed: results.filter(r => !r.success).length,
  }
}
```

## Error Handling

### Subtask Failure Recovery

```typescript
async function executeWithRecovery(
  subtask: Subtask
): Promise<SubtaskResult> {
  try {
    return await executeSubtask(subtask)
  } catch (error) {
    // Attempt recovery strategies
    if (subtask.priority === 'critical') {
      // Retry with different agent
      const fallbackAgent = selectFallbackAgent(subtask.agentType)
      return await fallbackAgent.execute(subtask)
    } else {
      // Mark as failed but continue
      return {
        subtask: subtask.description,
        success: false,
        error: error.message
      }
    }
  }
}
```

### Plan Validation

```typescript
function validatePlan(plan: Plan): ValidationResult {
  const issues: string[] = []

  // Check for circular dependencies
  if (hasCircularDependencies(plan.subtasks)) {
    issues.push('Circular dependencies detected')
  }

  // Check subtask count
  if (plan.subtasks.length === 0) {
    issues.push('Plan has no subtasks')
  }

  if (plan.subtasks.length > 10) {
    issues.push('Plan has too many subtasks (>10), consider hierarchical planning')
  }

  // Check dependencies exist
  plan.subtasks.forEach(task => {
    task.dependencies.forEach(dep => {
      if (!plan.subtasks.find(t => t.id === dep)) {
        issues.push(`Subtask ${task.id} depends on non-existent task ${dep}`)
      }
    })
  })

  return {
    valid: issues.length === 0,
    issues
  }
}
```

## Configuration

```typescript
interface PlanningConfig {
  maxSubtasks: number           // Default: 7
  allowReplanning: boolean      // Default: true
  parallelExecution: boolean    // Default: true
  requireApproval: boolean      // User approval before execution
  progressUpdates: boolean      // Show progress
}
```

## Example: Complete Feature Implementation

```typescript
// User: "Add user authentication with JWT tokens"

// 1. ANALYZE
const analysis = {
  complexity: 'complex',
  domain: ['authentication', 'security', 'backend'],
  requirements: [
    'User registration',
    'Login with credentials',
    'JWT token generation',
    'Token validation middleware',
    'Logout/token revocation'
  ],
  constraints: ['Must be secure', 'Follow best practices']
}

// 2. CREATE PLAN
const plan = {
  approach: 'incremental-secure-implementation',
  subtasks: [
    // Wave 1 (parallel)
    {
      id: 'research-auth',
      description: 'Research JWT best practices and security considerations',
      type: 'research',
      dependencies: []
    },
    {
      id: 'analyze-codebase',
      description: 'Analyze existing user model and API structure',
      type: 'analysis',
      dependencies: []
    },

    // Wave 2
    {
      id: 'design-architecture',
      description: 'Design authentication flow and middleware structure',
      type: 'design',
      dependencies: ['research-auth', 'analyze-codebase']
    },

    // Wave 3 (parallel)
    {
      id: 'implement-registration',
      description: 'Implement user registration endpoint',
      type: 'implementation',
      dependencies: ['design-architecture']
    },
    {
      id: 'implement-login',
      description: 'Implement login and JWT generation',
      type: 'implementation',
      dependencies: ['design-architecture']
    },
    {
      id: 'implement-middleware',
      description: 'Implement JWT validation middleware',
      type: 'implementation',
      dependencies: ['design-architecture']
    },

    // Wave 4
    {
      id: 'write-tests',
      description: 'Write comprehensive authentication tests',
      type: 'testing',
      dependencies: ['implement-registration', 'implement-login', 'implement-middleware']
    }
  ]
}

// 3. EXECUTE (in waves)
// 4. SYNTHESIZE results into complete solution
```

## Best Practices

1. **Optimal Decomposition**: 3-7 subtasks for most problems
2. **Clear Dependencies**: Explicit subtask relationships
3. **Parallel When Possible**: Maximize concurrent execution
4. **Validate Plans**: Check for circular dependencies
5. **Progress Updates**: Keep user informed
6. **Handle Failures**: Graceful degradation on subtask failure
7. **Synthesize Properly**: Ensure coherent final result
8. **Allow Adaptation**: Re-plan when needed

## Anti-Patterns

- Too many subtasks (>10)
- Overlapping or redundant subtasks
- Missing dependencies
- Sequential when parallel is possible
- No synthesis step
- Ignoring failed subtasks
- Over-planning simple tasks
