# Extended Thinking System for Duker

## Overview

This document describes the Extended Thinking System that enables Duker to perform deep, iterative reasoning similar to Claude Code. The system implements multi-step reasoning chains, self-critique loops, parallel thinking branches, and transparent meta-cognition.

## Core Principles

### 1. **Interleaved Thinking Mode**
- Thinking steps are interleaved with tool calls and observations
- Each thinking step builds on previous observations
- Transparent reasoning visible to user (optional)

### 2. **Extended Reasoning Chains**
- Support for 100+ step reasoning processes
- Token budget management for thinking vs output
- Early stopping when confidence is high

### 3. **Self-Critique and Iteration**
- Automatic critique of generated solutions
- Iterative refinement based on identified flaws
- Multi-dimensional quality assessment

### 4. **Tool-Augmented Reasoning**
- Web search integrated into reasoning loops
- Codebase context retrieval during thinking
- External validation of assumptions

### 5. **Parallel Thinking Branches**
- Explore multiple solution paths simultaneously
- Compare and synthesize best ideas
- Fallback options if primary path fails

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Extended Thinking Engine                    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Thinking Orchestrator                      │    │
│  │  - Manages thinking budget                         │    │
│  │  - Controls iteration depth                        │    │
│  │  - Decides when to stop                            │    │
│  └──────────────┬─────────────────────────────────────┘    │
│                 │                                            │
│  ┌──────────────┴──────────────────────────────────┐       │
│  │                                                  │       │
│  ▼                ▼               ▼                ▼       │
│ ┌─────┐      ┌────────┐      ┌────────┐      ┌────────┐  │
│ │Think│      │Observe │      │Critique│      │Refine  │  │
│ │Step │─────▶│ (Tool) │─────▶│  Step  │─────▶│ Step   │  │
│ └─────┘      └────────┘      └────────┘      └────────┘  │
│    │                                              │        │
│    └──────────────────┬───────────────────────────┘        │
│                       │                                    │
│                   (Loop until convergence)                 │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │         Parallel Thinking Branches                 │   │
│  │  Branch 1  │  Branch 2  │  Branch 3               │   │
│  │  ─────────────────────────────────                │   │
│  │  Approach A │ Approach B │ Approach C             │   │
│  │            ▼            ▼            ▼            │   │
│  │         [Synthesize Best Solution]               │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Components

### 1. **Thinking Step Manager**

**Purpose:** Manages individual thinking steps and tracks reasoning chains

**Responsibilities:**
- Record each thinking step with metadata
- Track dependencies between steps
- Measure confidence/certainty per step
- Detect circular reasoning

**Data Structure:**
```typescript
interface ThinkingStep {
  id: string;
  cycle: number;
  type: 'reasoning' | 'critique' | 'observation' | 'synthesis' | 'hypothesis';
  content: string;
  confidence: number;        // 0-1
  tokensUsed: number;
  dependencies: string[];    // IDs of prerequisite steps
  timestamp: number;
  branchId?: string;        // For parallel thinking
}

interface ThinkingChain {
  steps: ThinkingStep[];
  totalTokens: number;
  maxDepth: number;
  branches: ThinkingBranch[];
}
```

### 2. **Critique Engine**

**Purpose:** Self-evaluate reasoning and solutions

**Critique Dimensions:**
```typescript
interface CritiqueResult {
  // Logical Soundness
  logicalCoherence: number;      // 0-1: No contradictions?
  assumptionsValid: number;      // 0-1: Are assumptions justified?

  // Completeness
  coverageScore: number;         // 0-1: All aspects addressed?
  edgeCasesConsidered: number;   // 0-1: Edge cases handled?

  // Quality
  solutionQuality: number;       // 0-1: Overall quality
  bestPractices: number;         // 0-1: Follows standards?

  // Meta-Cognition
  uncertaintyAreas: string[];    // What we're uncertain about
  missingInformation: string[];  // What info would help?
  alternativeApproaches: string[]; // Other ways to solve?

  // Action Items
  needsMoreResearch: boolean;
  needsCodebaseContext: boolean;
  needsExternalValidation: boolean;

  overallConfidence: number;     // 0-1
  criticalIssues: string[];
  suggestions: string[];
}
```

**Critique Methods:**
- `critiqueSolution(solution: string, context: any): CritiqueResult`
- `identifyFlaws(reasoning: ThinkingChain): string[]`
- `suggestImprovements(critique: CritiqueResult): string[]`
- `compareAlternatives(solutions: string[]): RankedSolutions`

### 3. **Iteration Controller**

**Purpose:** Manage iteration cycles with smart stopping

**Stopping Conditions:**
```typescript
interface IterationConfig {
  maxThinkingTokens: number;     // Default: 10000
  maxCycles: number;             // Default: 20
  maxDuration: number;           // Default: 300s (5 min)

  // Quality thresholds
  minConfidence: number;         // Default: 0.85
  minQuality: number;            // Default: 0.90

  // Improvement tracking
  minImprovement: number;        // Default: 0.05 (5%)
  stalledCycles: number;         // Default: 3

  // Early stopping
  earlyStopConfidence: number;   // Default: 0.95 (stop early if very confident)
}

interface StoppingDecision {
  shouldStop: boolean;
  reason: 'quality_met' | 'confidence_met' | 'stalled' |
          'max_iterations' | 'max_tokens' | 'timeout' |
          'diminishing_returns';
  metrics: {
    currentQuality: number;
    currentConfidence: number;
    improvement: number;
    cyclesStalled: number;
    tokensUsed: number;
  };
}
```

**Methods:**
- `shouldContinue(state: IterationState): StoppingDecision`
- `trackImprovement(previous: any, current: any): number`
- `detectStall(history: IterationCycle[]): boolean`

### 4. **Parallel Thinking Engine**

**Purpose:** Explore multiple solution approaches simultaneously

**Branch Types:**
```typescript
type BranchStrategy =
  | 'different_algorithms'    // Try different algos
  | 'different_libraries'     // Different tech stacks
  | 'different_architectures' // Design patterns
  | 'optimistic_vs_cautious'  // Risk profiles
  | 'simple_vs_complex';      // Complexity tradeoffs

interface ThinkingBranch {
  id: string;
  strategy: BranchStrategy;
  description: string;
  steps: ThinkingStep[];
  solution?: string;
  quality?: number;
  confidence?: number;
  tradeoffs: {
    pros: string[];
    cons: string[];
    complexity: 'low' | 'medium' | 'high';
    performance: 'low' | 'medium' | 'high';
  };
}
```

**Synthesis:**
- Compare branches on multiple dimensions
- Hybrid solutions combining best features
- Ranked recommendations with tradeoffs

### 5. **Tool-Augmented Reasoning**

**Purpose:** Integrate external knowledge into thinking loops

**Augmentation Strategies:**

#### **Web Search Integration**
```typescript
interface ResearchNeed {
  question: string;
  urgency: 'blocking' | 'helpful' | 'optional';
  searchType: 'general' | 'code' | 'docs' | 'academic';
  maxResults: number;
}

// Automatically triggered during thinking when:
// - Uncertainty is high about a concept
// - Need latest information (libraries, APIs, best practices)
// - Validating assumptions
// - Finding examples or patterns
```

**Example Flow:**
```
Think: "I need to implement OAuth2. I'm uncertain about the latest security recommendations."
  → Detect uncertainty → Trigger web search
  → Search: "OAuth2 security best practices 2025"
  → Observe: [Search results]
  → Think: "Based on results, PKCE is now recommended for all clients..."
  → Continue reasoning with new knowledge
```

#### **Codebase Context Integration**
```typescript
interface ContextNeed {
  type: 'similar_code' | 'dependencies' | 'usage_examples' | 'tests';
  query: string;
  scope: 'current_file' | 'current_module' | 'entire_project';
}

// Automatically triggered when:
// - Need to understand existing patterns
// - Find similar implementations
// - Check how dependencies are used
// - Validate assumptions about codebase
```

#### **Memory Integration**
```typescript
// Reference past decisions and learnings
// - Previous solutions to similar problems
// - User preferences (style, libraries, patterns)
// - Project-specific conventions
// - Known bugs/pitfalls
```

---

## Implementation Strategy

### Phase 1: Core Thinking Engine (Priority: HIGH)

**Files to Create:**
1. `/src/core/thinking/thinking-step-manager.ts` - Step tracking
2. `/src/core/thinking/critique-engine.ts` - Self-evaluation
3. `/src/core/thinking/iteration-controller.ts` - Smart stopping
4. `/src/core/thinking/thinking-chain.ts` - Chain management

**Integration:**
- Extend `IterationManager` to use new thinking components
- Add thinking chain to `SessionState`
- UI rendering for thinking steps (optional transparency)

### Phase 2: Parallel Thinking (Priority: MEDIUM)

**Files to Create:**
1. `/src/core/thinking/parallel-thinking-engine.ts` - Branch management
2. `/src/core/thinking/branch-synthesizer.ts` - Combine solutions

**Integration:**
- Add to `PlanningAgent` for complex tasks
- New pattern: `parallel-thinking` in `RouterAgentV2`

### Phase 3: Tool-Augmented Reasoning (Priority: HIGH)

**Files to Create:**
1. `/src/core/thinking/research-orchestrator.ts` - Auto web search
2. `/src/core/thinking/context-retriever.ts` - Smart codebase queries

**Integration:**
- Hook into thinking loop to detect uncertainty
- Automatic web search triggers
- Context retrieval before code generation

### Phase 4: Enhanced Agent Patterns (Priority: MEDIUM)

**Upgrades:**
1. **ReflectionAgentV3** - Uses full thinking system
2. **ReActAgent** - Reasoning + Action pattern
3. **ChainOfThoughtAgent** - Explicit CoT prompting
4. **TreeOfThoughtAgent** - Search-based reasoning

---

## Usage Examples

### Example 1: Deep Reasoning for Complex Problem

```typescript
// User: "Design a distributed caching system with high availability"

const thinkingEngine = new ExtendedThinkingEngine({
  maxThinkingTokens: 15000,
  maxCycles: 25,
  minConfidence: 0.90,
  enableParallelBranches: true
});

// Automatic flow:
// Cycle 1: Think about requirements
//   - High availability needs
//   - CAP theorem considerations
//   - Consistency vs availability tradeoffs
//
// Cycle 2: Research latest practices
//   - Trigger web search: "distributed caching 2025 best practices"
//   - Observe: Redis Cluster, Hazelcast, Apache Ignite
//   - Think: Compare approaches
//
// Cycle 3: Parallel branches
//   - Branch A: Redis Cluster with Sentinel
//   - Branch B: Hazelcast with CP subsystem
//   - Branch C: Custom solution with Raft
//
// Cycle 4-10: Develop each branch
//   - Think through architecture
//   - Identify pros/cons
//   - Consider failure scenarios
//
// Cycle 11: Critique each branch
//   - Evaluate: complexity, ops burden, performance
//   - Find gaps in reasoning
//
// Cycle 12-15: Refine top 2 branches
//   - Address identified issues
//   - Add missing details
//
// Cycle 16: Synthesize final recommendation
//   - Rank options
//   - Provide clear tradeoffs
//   - Implementation guidance
```

### Example 2: Iterative Code Refinement with Research

```typescript
// User: "Write a TypeScript function to parse and validate JWT tokens"

const agent = new ReflectionAgentV3({
  thinkingConfig: {
    maxCycles: 15,
    enableWebSearch: true,
    enableCodebaseContext: true
  }
});

// Automatic flow:
// Cycle 1: Initial generation
//   - Think: JWT structure, validation needs
//   - Uncertain: Latest security best practices
//   - Search: "JWT validation security 2025"
//   - Observe: Algorithm confusion attacks, key management
//   - Generate: Initial implementation
//
// Cycle 2: Critique
//   - Evaluate: Security, completeness, error handling
//   - Issues: Missing algorithm whitelist, weak error messages
//   - Confidence: 0.65
//
// Cycle 3: Research refinement
//   - Search: "typescript JWT validation library comparison"
//   - Observe: jsonwebtoken, jose, jwt-decode
//   - Think: Should use 'jose' (modern, secure)
//
// Cycle 4: Refine implementation
//   - Add algorithm whitelist
//   - Better error handling
//   - Use jose library
//
// Cycle 5: Critique
//   - Evaluate: Improved to 0.85
//   - Remaining: Missing rate limiting consideration
//
// Cycle 6: Final refinement
//   - Add rate limiting notes
//   - Comprehensive error types
//   - Quality: 0.92, Confidence: 0.93
//   - Stop: Thresholds met
```

### Example 3: Multi-Agent with Extended Thinking

```typescript
// User: "Review this authentication system for security issues"

const coordinator = new MultiAgentCoordinator({
  enableExtendedThinking: true,
  thinkingTokensPerAgent: 5000
});

// SecurityAgent thinking:
// - Think: Check for common auth vulnerabilities
// - Research: "authentication security vulnerabilities 2025"
// - Observe: New attack vectors
// - Think: Apply to this codebase
// - Critique: Initial findings
// - Refine: Add specific remediation steps

// PerformanceAgent thinking:
// - Think: Auth bottlenecks
// - Search codebase: Similar implementations
// - Observe: Patterns used elsewhere
// - Think: Compare approaches
// - Recommendations with confidence scores

// Final synthesis: Combined insights with cross-agent validation
```

---

## Configuration

### Global Thinking Settings

```typescript
// duker.config.ts or .dukerrc
{
  "thinking": {
    "enabled": true,
    "transparency": "summary" | "full" | "none",
    "maxTokensPerRequest": 10000,
    "defaultCycles": 15,
    "autoWebSearch": true,
    "autoContextRetrieval": true,
    "parallelBranches": {
      "enabled": true,
      "maxBranches": 3
    },
    "stoppingCriteria": {
      "minConfidence": 0.85,
      "minQuality": 0.90,
      "earlyStopConfidence": 0.95
    }
  }
}
```

### Per-Agent Configuration

```typescript
// Override for specific agents
const agent = new ReflectionAgentV3({
  thinking: {
    maxTokens: 20000,  // More thinking for complex tasks
    cycles: 30,
    minQuality: 0.95   // Higher bar
  }
});
```

---

## Monitoring & Transparency

### Thinking Visibility Levels

1. **None** - No thinking shown, only final answer
2. **Summary** - Show thinking summary per cycle
3. **Full** - Show every thinking step (verbose)

### UI Display

```
┌─────────────────────────────────────────┐
│ 🧠 Thinking... (Cycle 3/15)           │
│                                         │
│ ├─ Reasoning about approach...         │
│ ├─ 🔍 Searching: "JWT security 2025"  │
│ ├─ Observed 5 results                  │
│ ├─ Analyzing best practices...         │
│ └─ Confidence: 0.73 → 0.81 (+11%)     │
│                                         │
│ Token budget: 3,241 / 10,000           │
└─────────────────────────────────────────┘
```

### Metrics Dashboard

```typescript
interface ThinkingMetrics {
  totalThinkingTokens: number;
  averageCyclesPerTask: number;
  averageConfidenceGain: number;
  webSearchesTriggered: number;
  contextRetrievals: number;
  earlyStops: number;
  iterationTimeouts: number;
  averageQualityScore: number;
}
```

---

## Benefits

### For Users
- **Better Solutions**: Deeper reasoning leads to higher quality
- **Transparency**: See how Duker thinks (optional)
- **Confidence**: Know when Duker is uncertain
- **Options**: Parallel branches provide alternatives

### For Development
- **Debugging**: Trace reasoning failures
- **Optimization**: Identify token-heavy patterns
- **Learning**: Understand model capabilities
- **Improvement**: Tune stopping criteria

---

## Next Steps

1. Implement core thinking engine (Phase 1)
2. Integrate with existing agents
3. Add web search auto-triggering (Phase 3)
4. Implement parallel thinking (Phase 2)
5. Create new agent patterns (Phase 4)
6. Build UI transparency features
7. Add configuration options
8. Performance testing and optimization

---

## References

- Anthropic Extended Thinking: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
- Chain-of-Thought Prompting: https://arxiv.org/abs/2201.11903
- ReAct Pattern: https://arxiv.org/abs/2210.03629
- Tree-of-Thought: https://arxiv.org/abs/2305.10601
