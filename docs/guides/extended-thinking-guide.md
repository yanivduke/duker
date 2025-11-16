# Extended Thinking System - User Guide

## Overview

Duker's Extended Thinking System enables Claude Code-level deep reasoning through:

1. **100+ Step Reasoning** - Extended thinking chains with iterative refinement
2. **Self-Critique Loops** - Automatic quality assessment and improvement
3. **Web Search Integration** - Real-time research during reasoning
4. **Parallel Thinking** - Explore multiple approaches simultaneously
5. **Transparent Meta-Cognition** - See how Duker thinks (optional)

## Quick Start

### Basic Usage with ReflectionAgentV3

```typescript
import { ReflectionAgentV3 } from './agents/reflection-agent-v3';
import { LLMManager } from './llm/llm-manager';

// Initialize
const llmManager = new LLMManager();
const provider = llmManager.getProvider('anthropic');

const agent = new ReflectionAgentV3(provider, {
  enableWebSearch: true,
  enableCodebaseContext: true,
  enableParallelThinking: false,
  enableThinkingTransparency: true,
});

// Execute
const result = await agent.execute(
  "Write a TypeScript function to implement a LRU cache with O(1) operations"
);

console.log(result.output);
console.log(`Quality: ${result.metadata.finalQuality}`);
console.log(`Iterations: ${result.metadata.iterations}`);
```

### Configuration Options

```typescript
const agent = new ReflectionAgentV3(provider, {
  // Thinking configuration
  thinkingConfig: {
    maxThinkingTokens: 15000,    // Token budget
    maxCycles: 25,               // Max iterations
    minConfidence: 0.85,         // Stop when confident
    minQuality: 0.92,            // Quality threshold
    earlyStopConfidence: 0.95,   // Early stop if very confident
  },

  // Feature flags
  enableWebSearch: true,              // Auto web search
  enableCodebaseContext: true,        // Auto context retrieval
  enableParallelThinking: true,       // Explore multiple approaches
  enableThinkingTransparency: true,   // Show thinking steps

  // Context
  language: 'TypeScript',
  codebaseContext: 'Using Vue 3 and Vercel AI SDK',

  // UI callbacks
  onProgress: (msg, progress) => {
    console.log(`[${(progress * 100).toFixed(0)}%] ${msg}`);
  },
  onThinkingStep: (step) => {
    console.log(`  🧠 ${step}`);
  },
  onResearch: (query) => {
    console.log(`  🔍 Searching: ${query}`);
  },
});
```

## Advanced Usage

### 1. Direct Extended Thinking Engine

For custom workflows:

```typescript
import { ExtendedThinkingEngine } from './core/thinking';
import { WebSearchTool } from './mcp/web-search-tool';

const thinkingEngine = new ExtendedThinkingEngine(llmProvider, {
  config: {
    maxThinkingTokens: 20000,
    maxCycles: 30,
  },
  onResearchNeeded: async (need) => {
    // Custom research logic
    const webSearch = new WebSearchTool();
    const results = await webSearch.execute({
      query: need.question,
      maxResults: 5,
    });
    return JSON.stringify(results);
  },
});

const result = await thinkingEngine.think(
  "Design a distributed caching system",
  {
    language: "System Design",
    codebaseContext: "Microservices architecture",
  }
);

console.log(result.solution);
console.log(`Quality: ${result.quality}, Confidence: ${result.confidence}`);
console.log(`Iterations: ${result.iterations}, Tokens: ${result.tokensUsed}`);
```

### 2. Parallel Thinking for Architecture Decisions

```typescript
import { ParallelThinkingEngine } from './core/thinking';

const parallelEngine = new ParallelThinkingEngine(llmProvider);

// Explore multiple architectural approaches
const result = await parallelEngine.explore(
  "Design an authentication system for our app",
  ['different_libraries', 'different_architectures'],
  {
    language: 'TypeScript',
    constraints: [
      'Must support OAuth2',
      'Should scale to 1M users',
      'Budget: 2 weeks development time',
    ],
    maxBranches: 3,
  }
);

// View all branches
result.branches.forEach((branch, i) => {
  console.log(`\nApproach ${i + 1}: ${branch.description}`);
  console.log(`Score: ${branch.recommendationScore}`);
  console.log(`Pros: ${branch.tradeoffs.pros.join(', ')}`);
  console.log(`Cons: ${branch.tradeoffs.cons.join(', ')}`);
});

// Best solution (synthesized from all branches)
console.log('\n=== Recommended Solution ===');
console.log(result.synthesizedSolution);

// Detailed comparison
console.log('\n=== Comparison ===');
console.log(result.comparisonAnalysis);
```

### 3. ReAct Pattern (Reasoning + Action)

```typescript
import { ReActAgent } from './agents/react-agent';
import { ShellTool, WebSearchTool, ContextTool } from './mcp';

const tools = [
  new ShellTool(),
  new WebSearchTool(),
  new ContextTool(),
];

const reactAgent = new ReActAgent(llmProvider, tools, {
  maxSteps: 20,
  maxToolCalls: 15,
  enableThinking: true,
});

const result = await reactAgent.execute(
  "Find all TypeScript files using the 'any' type and suggest fixes"
);

console.log(result.output);
console.log(`Steps: ${result.metadata.steps}`);
console.log(`Tool calls: ${result.metadata.toolsUsed}`);
```

### 4. Custom Critique and Iteration

```typescript
import { CritiqueEngine, IterationController } from './core/thinking';

const critiqueEngine = new CritiqueEngine(llmProvider);
const iterationController = new IterationController({
  maxCycles: 10,
  minQuality: 0.90,
});

let solution = "initial code here...";
let iteration = 0;

while (true) {
  iteration++;

  // Critique current solution
  const critique = await critiqueEngine.critiqueSolution(
    "Implement binary search",
    solution,
    { language: 'TypeScript', previousCritique }
  );

  console.log(`Iteration ${iteration}:`);
  console.log(`Quality: ${critique.solutionQuality.toFixed(2)}`);
  console.log(`Issues: ${critique.criticalIssues.join(', ')}`);

  // Check stopping conditions
  const state = {
    cycle: iteration,
    currentQuality: critique.solutionQuality,
    currentConfidence: critique.overallConfidence,
    // ... other state
  };

  const decision = iterationController.shouldContinue(state);
  if (decision.shouldStop) {
    console.log(`Stopping: ${decision.reason}`);
    break;
  }

  // Refine solution
  solution = await refineSolution(solution, critique);
}
```

## Real-World Examples

### Example 1: Code Generation with Research

```typescript
const agent = new ReflectionAgentV3(provider, {
  enableWebSearch: true,
  thinkingConfig: {
    maxCycles: 20,
  },
});

const result = await agent.execute(`
  Implement a React component for infinite scrolling with:
  - Virtual scrolling for performance
  - Intersection Observer API
  - TypeScript
  - Loading states
  - Error handling
`);

// Duker will automatically:
// 1. Search for "React infinite scroll best practices 2025"
// 2. Search for "Intersection Observer API usage"
// 3. Generate initial implementation
// 4. Critique for performance, TypeScript types, edge cases
// 5. Refine based on research and critique
// 6. Iterate until quality threshold met
```

### Example 2: System Design with Parallel Thinking

```typescript
const agent = new ReflectionAgentV3(provider, {
  enableParallelThinking: true,
  enableWebSearch: true,
});

const result = await agent.execute(`
  Design a real-time notification system for a chat app.
  Consider: WebSockets vs SSE vs Long Polling
  Scale: 100k concurrent users
`);

// Duker will:
// 1. Identify this as an architecture decision
// 2. Create parallel branches:
//    - Branch A: WebSockets with Socket.io
//    - Branch B: Server-Sent Events (SSE)
//    - Branch C: Long Polling with fallback
// 3. Research each approach
// 4. Compare tradeoffs
// 5. Synthesize best solution
// 6. Refine with deep thinking
```

### Example 3: Debugging with ReAct

```typescript
const tools = [
  new ShellTool(),
  new ContextTool(),
];

const reactAgent = new ReActAgent(provider, tools);

const result = await reactAgent.execute(`
  Debug why tests are failing in UserService.test.ts
`);

// ReAct loop:
// Thought: Need to see the test file
// Action: ContextTool.read("UserService.test.ts")
// Observation: [file contents]
//
// Thought: I see the test is mocking incorrectly
// Action: ContextTool.read("UserService.ts")
// Observation: [implementation]
//
// Thought: The mock doesn't match actual API
// Answer: The issue is... here's the fix...
```

## Integration with Existing Agents

### Update RouterAgentV2 to use ReflectionAgentV3

```typescript
// In router-agent-v2.ts
import { ReflectionAgentV3 } from './reflection-agent-v3';

async selectAndExecuteAgent(analysis: TaskAnalysis): Promise<AgentResponse> {
  switch (analysis.recommendedPattern) {
    case 'reflection':
      // Use V3 for complex code generation
      if (analysis.complexity === 'complex') {
        const agentV3 = new ReflectionAgentV3(this.llmProvider, {
          enableWebSearch: true,
          enableParallelThinking: false,
          language: analysis.language,
        });
        return agentV3.execute(this.userInput);
      }
      // Use V2 for simpler tasks
      return this.reflectionAgentV2.execute(this.userInput);

    // ... other patterns
  }
}
```

## Best Practices

### 1. Token Budget Management

```typescript
// For local models (limited context)
thinkingConfig: {
  maxThinkingTokens: 5000,
  maxCycles: 10,
}

// For cloud models (extended context)
thinkingConfig: {
  maxThinkingTokens: 20000,
  maxCycles: 30,
}
```

### 2. When to Use Parallel Thinking

Use parallel thinking when:
- Evaluating multiple libraries/frameworks
- Architectural decisions with tradeoffs
- Comparing algorithms
- Design pattern selection

Skip parallel thinking when:
- Simple, straightforward tasks
- Token budget is limited
- Speed is critical

### 3. Web Search Integration

Auto-search triggers when:
- Uncertainty about latest best practices
- Need library/API documentation
- Validating assumptions
- Finding code examples

Control with:
```typescript
enableWebSearch: true,  // Enable auto-search
thinkingConfig: {
  enableWebSearch: true,
}
```

### 4. Thinking Transparency

For debugging:
```typescript
enableThinkingTransparency: true,
onThinkingStep: (step) => console.log(step),
```

For production:
```typescript
enableThinkingTransparency: false, // Faster, less verbose
```

## Performance Tips

1. **Use Local Models for Simple Tasks**: Reserve extended thinking for complex problems
2. **Set Quality Thresholds**: Higher thresholds = more iterations
3. **Early Stopping**: Enable `earlyStopConfidence: 0.95` to stop when very confident
4. **Limit Research**: Auto-research is limited to 2-3 searches per cycle
5. **Parallel Branch Limit**: Max 3 branches to balance exploration vs cost

## Monitoring and Debugging

### Track Thinking Metrics

```typescript
import { ThinkingMetrics } from './core/thinking/types';

const metrics: ThinkingMetrics = {
  totalThinkingTokens: 0,
  averageCyclesPerTask: 0,
  averageConfidenceGain: 0,
  webSearchesTriggered: 0,
  contextRetrievals: 0,
  earlyStops: 0,
  iterationTimeouts: 0,
  averageQualityScore: 0,
  averageImprovementPerCycle: 0,
  branchesExplored: 0,
  synthesisOperations: 0,
};

// Update after each task
result.metadata; // Contains metrics
```

### View Thinking Chain

```typescript
const result = await agent.execute(task);
const thinkingChain = result.metadata.thinkingChain;

// Analyze the chain
console.log(`Total steps: ${thinkingChain.steps.length}`);
console.log(`Cycles: ${thinkingChain.currentCycle}`);
console.log(`Tokens: ${thinkingChain.totalTokens}`);

// View specific steps
thinkingChain.steps.forEach(step => {
  console.log(`[${step.type}] ${step.content} (confidence: ${step.confidence})`);
});
```

## Troubleshooting

### Problem: Agent runs too many iterations

**Solution:**
```typescript
thinkingConfig: {
  maxCycles: 15,           // Reduce max cycles
  earlyStopConfidence: 0.90, // Lower early stop threshold
  stalledCycles: 2,        // Stop sooner if stalled
}
```

### Problem: Quality not improving

**Solution:**
- Enable web search for more information
- Provide better codebase context
- Use parallel thinking to explore alternatives
- Lower quality threshold if adequate

### Problem: Too many web searches

**Solution:**
- Web searches auto-limited to 2-3 per cycle
- Reduce `maxCycles` to limit total searches
- Set `enableWebSearch: false` for offline work

### Problem: High token usage

**Solution:**
```typescript
thinkingConfig: {
  maxThinkingTokens: 8000,  // Strict budget
  maxCycles: 10,            // Fewer iterations
}
// Use local models for complex thinking
```

## Next Steps

- Explore [Extended Thinking System Spec](../specs/extended-thinking-system.md)
- See [Architecture Overview](../architecture.md)
- Check [Agent Patterns Guide](./agent-patterns.md)
- Try [Example Projects](../examples/)

## Support

For issues or questions:
- GitHub: [duker/issues](https://github.com/yourusername/duker/issues)
- Docs: [duker documentation](https://duker.dev/docs)
