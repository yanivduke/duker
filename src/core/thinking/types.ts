/**
 * Extended Thinking System Types
 *
 * Core type definitions for the extended thinking engine that enables
 * deep, iterative reasoning with self-critique and parallel exploration.
 */

export type ThinkingStepType =
  | 'reasoning'      // General logical reasoning
  | 'critique'       // Self-evaluation of ideas
  | 'observation'    // Tool results/external info
  | 'synthesis'      // Combining multiple ideas
  | 'hypothesis'     // Proposed solution/approach
  | 'validation'     // Checking assumptions
  | 'exploration';   // Exploring alternatives

export interface ThinkingStep {
  id: string;
  cycle: number;
  type: ThinkingStepType;
  content: string;
  confidence: number;        // 0-1: How confident in this step
  tokensUsed: number;
  dependencies: string[];    // IDs of prerequisite steps
  timestamp: number;
  branchId?: string;        // For parallel thinking
  metadata?: {
    toolUsed?: string;
    searchQuery?: string;
    codeReference?: string;
    relatedSteps?: string[];
  };
}

export interface ThinkingChain {
  id: string;
  steps: ThinkingStep[];
  totalTokens: number;
  maxDepth: number;
  currentCycle: number;
  branches: ThinkingBranch[];
  startTime: number;
  endTime?: number;
}

export interface CritiqueResult {
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
  researchQueries?: string[];    // Suggested web searches

  overallConfidence: number;     // 0-1
  criticalIssues: string[];
  suggestions: string[];

  // Improvement tracking
  previousScore?: number;
  improvement?: number;
}

export interface IterationConfig {
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

  // Tool augmentation
  enableWebSearch: boolean;      // Auto-trigger web searches
  enableCodebaseContext: boolean; // Auto-retrieve codebase context

  // Transparency
  showThinkingSteps: boolean;    // Display thinking to user
  thinkingVisibility: 'none' | 'summary' | 'full';
}

export type StoppingReason =
  | 'quality_met'
  | 'confidence_met'
  | 'stalled'
  | 'max_iterations'
  | 'max_tokens'
  | 'timeout'
  | 'diminishing_returns'
  | 'user_cancelled';

export interface StoppingDecision {
  shouldStop: boolean;
  reason: StoppingReason;
  metrics: {
    currentQuality: number;
    currentConfidence: number;
    improvement: number;
    cyclesStalled: number;
    tokensUsed: number;
    duration: number;
  };
  explanation?: string;
}

export type BranchStrategy =
  | 'different_algorithms'    // Try different algos
  | 'different_libraries'     // Different tech stacks
  | 'different_architectures' // Design patterns
  | 'optimistic_vs_cautious'  // Risk profiles
  | 'simple_vs_complex';      // Complexity tradeoffs

export interface ThinkingBranch {
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
    maintainability: 'low' | 'medium' | 'high';
  };
  estimatedEffort?: string;
  recommendationScore?: number; // 0-1
}

export interface ResearchNeed {
  question: string;
  urgency: 'blocking' | 'helpful' | 'optional';
  searchType: 'general' | 'code' | 'docs' | 'academic';
  maxResults: number;
  context?: string; // Additional context for search
}

export interface ContextNeed {
  type: 'similar_code' | 'dependencies' | 'usage_examples' | 'tests' | 'documentation';
  query: string;
  scope: 'current_file' | 'current_module' | 'entire_project';
  priority: 'high' | 'medium' | 'low';
}

export interface ThinkingMetrics {
  totalThinkingTokens: number;
  averageCyclesPerTask: number;
  averageConfidenceGain: number;
  webSearchesTriggered: number;
  contextRetrievals: number;
  earlyStops: number;
  iterationTimeouts: number;
  averageQualityScore: number;
  averageImprovementPerCycle: number;
  branchesExplored: number;
  synthesisOperations: number;
}

export interface IterationState {
  cycle: number;
  chain: ThinkingChain;
  currentSolution?: any;
  currentQuality: number;
  currentConfidence: number;
  lastImprovement: number;
  cyclesSinceImprovement: number;
  tokensUsed: number;
  startTime: number;
  researchPerformed: number;
  contextRetrievals: number;
}

export interface ExtendedThinkingOptions {
  config: IterationConfig;
  onThinkingStep?: (step: ThinkingStep) => void;
  onCycleComplete?: (state: IterationState) => void;
  onStoppingDecision?: (decision: StoppingDecision) => void;
  onResearchNeeded?: (need: ResearchNeed) => Promise<string>;
  onContextNeeded?: (need: ContextNeed) => Promise<string>;
}
