# ReAct Pattern Specification

## Overview

ReAct (Reasoning + Acting) combines iterative reasoning with tool execution. The agent alternates between thinking about what to do next and taking actions, creating a powerful feedback loop for complex problem-solving.

## Core Concept

```
Thought → Action → Observation → Thought → Action → ... → Answer
```

The agent reasons about the problem, takes an action (uses a tool), observes the result, reasons about next steps, and repeats until the problem is solved.

## Architecture

```typescript
interface ReActAgent {
  think(context: Context): Promise<Thought>
  act(thought: Thought): Promise<Action>
  observe(action: Action): Promise<Observation>
  shouldContinue(history: Step[]): boolean
  execute(input: TaskInput): Promise<Response>
}

interface Step {
  thought: string
  action: Action
  observation: Observation
}
```

## ReAct Loop

```typescript
async function executeReAct(input: TaskInput): Promise<Response> {
  const history: Step[] = []
  let context = { input, history }

  while (shouldContinue(history)) {
    // 1. THINK: Reason about next step
    const thought = await think(context)

    // 2. ACT: Execute action based on thought
    const action = await act(thought)

    // 3. OBSERVE: Capture results
    const observation = await observe(action)

    // 4. UPDATE: Add to history
    history.push({ thought, action, observation })
    context = { input, history }

    // 5. CHECK: Determine if done
    if (observation.isFinal) {
      return generateResponse(history)
    }
  }

  return generateResponse(history)
}
```

## Thought Generation

### Thought Prompt Template

```typescript
const thoughtPrompt = `
Previous steps:
${history.map(step => `
  Thought: ${step.thought}
  Action: ${step.action.name}(${JSON.stringify(step.action.params)})
  Observation: ${step.observation.result}
`).join('\n')}

Current situation:
- Original task: ${input.task}
- Information gathered: ${summarizeObservations(history)}
- Remaining questions: ${identifyGaps(history)}

Think step-by-step:
1. What do I know so far?
2. What do I still need to find out?
3. What's the best next action?
4. Can I answer the question with current information?

Thought:
`
```

### Thought Structure

```typescript
interface Thought {
  analysis: string           // Current understanding
  gaps: string[]            // Missing information
  nextStep: string          // Planned action
  confidence: number        // 0-1 confidence level
  canAnswer: boolean        // Can provide final answer?
}
```

## Action Types

### Tool Actions

```typescript
type Action =
  | { type: 'search'; query: string }
  | { type: 'read_file'; path: string }
  | { type: 'execute_code'; code: string }
  | { type: 'analyze'; target: string }
  | { type: 'answer'; response: string }

const actionExecutors = {
  search: async (query: string) => {
    return await webSearchTool.execute({ query })
  },

  read_file: async (path: string) => {
    return await contextTool.readFile(path)
  },

  execute_code: async (code: string) => {
    return await shellTool.execute({ command: code })
  },

  analyze: async (target: string) => {
    return await contextTool.analyzeCode(target)
  },

  answer: async (response: string) => {
    return { isFinal: true, result: response }
  }
}
```

## Observation Processing

### Observation Types

```typescript
interface Observation {
  result: any
  success: boolean
  isFinal: boolean
  insights: string[]
  errors?: string[]
}
```

### Observation Analysis

```typescript
function analyzeObservation(observation: Observation): ObservationAnalysis {
  return {
    answeredQuestions: extractAnswers(observation),
    newQuestions: extractNewQuestions(observation),
    relevance: calculateRelevance(observation),
    actionRequired: needsFollowup(observation)
  }
}
```

## Complete ReAct Example

### Debugging Task

```
User: "Why is my API returning 500 errors?"

Step 1:
  Thought: "I need to check the error logs first to see what's failing"
  Action: search("server error logs")
  Observation: Found logs showing database connection timeout

Step 2:
  Thought: "Database timeout detected. I should check the database configuration"
  Action: read_file("config/database.js")
  Observation: Connection pool size is set to 5

Step 3:
  Thought: "Small pool size might be the issue. Let me check how many concurrent requests we're getting"
  Action: execute_code("grep -c 'Request received' server.log | tail -100")
  Observation: Averaging 20-30 concurrent requests

Step 4:
  Thought: "Pool size of 5 is too small for 20-30 concurrent requests. That's causing the timeouts."
  Action: answer("The 500 errors are caused by database connection pool exhaustion. Your pool size is 5 but you're handling 20-30 concurrent requests. Increase pool size to at least 20-30 in config/database.js")
  Observation: Final answer provided
```

### Research Task

```
User: "What's the best way to implement real-time collaboration in Vue 3?"

Step 1:
  Thought: "I should search for current best practices on real-time collaboration"
  Action: search("Vue 3 real-time collaboration 2024")
  Observation: Found articles mentioning WebSockets, WebRTC, and CRDTs

Step 2:
  Thought: "Multiple approaches exist. Let me check if the codebase already uses any of these"
  Action: read_file("package.json")
  Observation: No WebSocket or WebRTC libraries installed

Step 3:
  Thought: "Fresh implementation. Let me get more specific info on Vue 3 + WebSockets"
  Action: search("Socket.io Vue 3 Composition API example")
  Observation: Found detailed implementation patterns

Step 4:
  Thought: "I have enough information to provide a comprehensive answer"
  Action: answer("For Vue 3 real-time collaboration, use Socket.io with Composition API...")
  Observation: Final answer provided
```

## Termination Conditions

### When to Stop

```typescript
function shouldContinue(history: Step[]): boolean {
  // Max iterations reached
  if (history.length >= maxSteps) {
    return false
  }

  // Final answer provided
  const lastObs = history[history.length - 1]?.observation
  if (lastObs?.isFinal) {
    return false
  }

  // No progress being made
  if (isStuck(history)) {
    return false
  }

  // Sufficient information gathered
  if (canAnswerQuestion(history)) {
    return false
  }

  return true
}
```

### Stuck Detection

```typescript
function isStuck(history: Step[]): boolean {
  // Same action repeated 3+ times
  const recentActions = history.slice(-3).map(s => s.action.type)
  if (new Set(recentActions).size === 1) {
    return true
  }

  // No new information in last 2 steps
  const recentObs = history.slice(-2).map(s => s.observation)
  if (recentObs.every(o => !o.insights || o.insights.length === 0)) {
    return true
  }

  return false
}
```

## Configuration

```typescript
interface ReActConfig {
  maxSteps: number              // Default: 10
  thoughtModel: string          // LLM for reasoning
  actionTimeout: number         // Max ms per action
  enableReflection: boolean     // Review thoughts?
  allowedActions: ActionType[]  // Restrict actions
  stopOnError: boolean          // Halt on action failure
}
```

## Prompting Strategies

### System Prompt

```typescript
const systemPrompt = `
You are a ReAct agent that solves problems through reasoning and action.

For each step:
1. THINK: Analyze the situation and decide what to do next
2. ACT: Take one concrete action
3. OBSERVE: Analyze the results
4. REPEAT: Until you can provide a final answer

Available actions:
- search(query): Search the web
- read_file(path): Read a file
- execute_code(command): Run a command
- analyze(target): Analyze code
- answer(response): Provide final answer

Always explain your reasoning before taking action.
Format your thoughts clearly and concisely.
`
```

### Step Formatting

```typescript
const stepFormat = `
Think: [Your reasoning about what to do next]

Act: [action_name](params)

Observe: [Results will be added here]

---
`
```

## Advanced Features

### Parallel Actions

```typescript
// Execute multiple independent actions simultaneously
async function actParallel(thoughts: Thought[]): Promise<Observation[]> {
  const actions = thoughts.map(t => selectAction(t))

  return await Promise.all(
    actions.map(action => observe(action))
  )
}
```

### Hierarchical ReAct

```typescript
// Sub-agents for complex sub-problems
async function hierarchicalReAct(input: TaskInput): Promise<Response> {
  const subTasks = await decomposeTask(input)

  const subResults = await Promise.all(
    subTasks.map(task => {
      // Each subtask gets its own ReAct loop
      return executeReAct(task)
    })
  )

  return combineResults(subResults)
}
```

### Memory-Enhanced ReAct

```typescript
interface ReActMemory {
  longTermFacts: Map<string, any>
  successfulPatterns: Pattern[]
  failedApproaches: Pattern[]
}

async function thinkWithMemory(
  context: Context,
  memory: ReActMemory
): Promise<Thought> {
  // Leverage past experience
  const similarCases = memory.successfulPatterns.filter(
    p => isSimilar(p.task, context.input)
  )

  // Avoid known failures
  const avoidActions = memory.failedApproaches.map(p => p.action)

  return generateThought(context, similarCases, avoidActions)
}
```

## Error Handling

### Action Failures

```typescript
async function executeActionWithRecovery(action: Action): Promise<Observation> {
  try {
    return await executeAction(action)
  } catch (error) {
    // Return error as observation
    return {
      result: null,
      success: false,
      isFinal: false,
      insights: [],
      errors: [error.message]
    }
  }
}
```

### Thought Validation

```typescript
function validateThought(thought: Thought): boolean {
  // Ensure thought is actionable
  if (!thought.nextStep) {
    return false
  }

  // Ensure making progress
  if (thought.gaps.length === 0 && !thought.canAnswer) {
    return false
  }

  return true
}
```

## Metrics & Monitoring

```typescript
interface ReActMetrics {
  averageSteps: number
  successRate: number
  mostUsedActions: Map<ActionType, number>
  averageTimePerStep: number
  stuckRate: number
}
```

## Use Cases

### Ideal for ReAct

- **Debugging**: Iterative investigation of issues
- **Research**: Multi-step information gathering
- **Code Analysis**: Progressive code understanding
- **Problem Solving**: Complex multi-step problems
- **Exploratory Tasks**: Unknown solution paths

### Not Ideal for ReAct

- **Simple Questions**: Direct answers suffice
- **No Tool Needed**: Pure reasoning tasks
- **Time-Sensitive**: Too many iterations
- **Deterministic**: Known solution path

## Integration with Other Patterns

### ReAct + Reflection

```typescript
// Reflect on each thought before acting
const thought = await think(context)
const reflectedThought = await reflectionAgent.evaluate(thought)

if (reflectedThought.quality < 0.7) {
  thought = await think(context, reflectedThought.feedback)
}
```

### ReAct + Planning

```typescript
// Use ReAct to explore, then plan based on findings
const explorationResults = await executeReAct(explorationTask)
const plan = await planningAgent.createPlan(explorationResults)
```

## Best Practices

1. **Clear Thoughts**: Make reasoning explicit and traceable
2. **Single Actions**: One action per step, not multiple
3. **Observation Analysis**: Extract insights from each observation
4. **Early Termination**: Stop when sufficient info gathered
5. **Error Recovery**: Handle failed actions gracefully
6. **Progress Tracking**: Monitor if making progress
7. **Action Diversity**: Avoid repeating same actions
8. **Thought Validation**: Ensure thoughts are actionable

## Anti-Patterns

- Taking actions without reasoning
- Ignoring previous observations
- Repeating failed actions
- Not analyzing observations
- Missing termination conditions
- Over-complicating simple tasks
- No error handling
