/**
 * Extended Thinking System Examples
 *
 * Practical examples showing how to use Duker's extended thinking
 * capabilities for various real-world scenarios.
 */

import { ReflectionAgentV3 } from '../src/agents/reflection-agent-v3';
import { ReActAgent } from '../src/agents/react-agent';
import { ExtendedThinkingEngine } from '../src/core/thinking/extended-thinking-engine';
import { ParallelThinkingEngine } from '../src/core/thinking/parallel-thinking-engine';
import { LLMManager } from '../src/llm/llm-manager';
import { WebSearchTool } from '../src/mcp/web-search-tool';
import { ShellTool } from '../src/mcp/shell-tool';
import { ContextTool } from '../src/mcp/context-tool';

// Initialize LLM
const llmManager = new LLMManager();
const provider = llmManager.getProvider('anthropic'); // or 'ollama' for local

/**
 * Example 1: Advanced Code Generation with Iterative Refinement
 */
async function example1_AdvancedCodeGeneration() {
  console.log('=== Example 1: Advanced Code Generation ===\n');

  const agent = new ReflectionAgentV3(provider, {
    enableWebSearch: true,
    enableCodebaseContext: false,
    enableThinkingTransparency: true,
    language: 'TypeScript',

    onProgress: (msg, progress) => {
      console.log(`[${(progress * 100).toFixed(0)}%] ${msg}`);
    },
    onResearch: (query) => {
      console.log(`🔍 Researching: ${query}`);
    },
  });

  const result = await agent.execute(`
    Create a TypeScript class for a rate limiter using the token bucket algorithm.
    Requirements:
    - Configurable rate and burst size
    - Thread-safe (async)
    - TypeScript with strict types
    - Comprehensive error handling
    - Unit testable
  `);

  console.log('\n=== Result ===');
  console.log(result.output);
  console.log(`\nQuality: ${result.metadata.finalQuality?.toFixed(2)}`);
  console.log(`Iterations: ${result.metadata.iterations}`);
  console.log(`Research performed: ${result.metadata.researchPerformed}`);
}

/**
 * Example 2: Architecture Decision with Parallel Thinking
 */
async function example2_ArchitectureDecision() {
  console.log('\n=== Example 2: Architecture Decision (Parallel Thinking) ===\n');

  const parallelEngine = new ParallelThinkingEngine(provider);

  const result = await parallelEngine.explore(
    "Choose a state management solution for a large Vue 3 application",
    ['different_libraries', 'different_architectures'],
    {
      language: 'TypeScript',
      constraints: [
        'Must support TypeScript',
        'Good DevTools support',
        'Active community',
      ],
      maxBranches: 3,
    }
  );

  console.log('=== Explored Approaches ===\n');
  result.branches.forEach((branch, i) => {
    console.log(`${i + 1}. ${branch.description}`);
    console.log(`   Score: ${(branch.recommendationScore! * 100).toFixed(0)}%`);
    console.log(`   Pros: ${branch.tradeoffs.pros.slice(0, 2).join(', ')}`);
    console.log(`   Cons: ${branch.tradeoffs.cons.slice(0, 2).join(', ')}`);
    console.log(`   Complexity: ${branch.tradeoffs.complexity}\n`);
  });

  console.log('=== Recommended Solution ===');
  console.log(result.synthesizedSolution);

  console.log('\n=== Comparison Analysis ===');
  console.log(result.comparisonAnalysis);
}

/**
 * Example 3: ReAct Pattern for Problem Solving
 */
async function example3_ReActProblemSolving() {
  console.log('\n=== Example 3: ReAct Pattern (Reasoning + Action) ===\n');

  const tools = [
    new ShellTool(),
    new ContextTool(),
  ];

  const reactAgent = new ReActAgent(provider, tools, {
    maxSteps: 15,
    maxToolCalls: 10,
  });

  const result = await reactAgent.execute(`
    Analyze the test coverage in this project and identify
    which modules need more tests.
  `);

  console.log('=== Result ===');
  console.log(result.output);
  console.log(`\nSteps taken: ${result.metadata.steps}`);
  console.log(`Tools used: ${result.metadata.toolsUsed}`);
}

/**
 * Example 4: Deep Research and Synthesis
 */
async function example4_DeepResearch() {
  console.log('\n=== Example 4: Deep Research ===\n');

  const agent = new ReflectionAgentV3(
    provider,
    {
      enableWebSearch: true,
      thinkingConfig: {
        maxCycles: 20,
        enableWebSearch: true,
      },
    },
    new WebSearchTool()
  );

  const result = await agent.execute(`
    Research and summarize the latest best practices for
    securing REST APIs in 2025. Include:
    - Authentication methods
    - Rate limiting strategies
    - Common vulnerabilities
    - Security headers
  `);

  console.log('=== Research Summary ===');
  console.log(result.output);
  console.log(`\nResearch queries: ${result.metadata.researchPerformed}`);
}

/**
 * Example 5: Custom Iteration Control
 */
async function example5_CustomIterationControl() {
  console.log('\n=== Example 5: Custom Iteration Control ===\n');

  const thinkingEngine = new ExtendedThinkingEngine(provider, {
    config: {
      maxThinkingTokens: 12000,
      maxCycles: 25,
      minQuality: 0.95,        // Very high quality bar
      minConfidence: 0.90,
      earlyStopConfidence: 0.98,
    },
    onCycleComplete: (state) => {
      console.log(
        `Cycle ${state.cycle}: ` +
        `Q=${state.currentQuality.toFixed(2)}, ` +
        `C=${state.currentConfidence.toFixed(2)}, ` +
        `Δ=${state.lastImprovement.toFixed(3)}`
      );
    },
  });

  const result = await thinkingEngine.think(
    "Implement a B-tree data structure in TypeScript with insert, delete, and search operations",
    {
      language: 'TypeScript',
    }
  );

  console.log('\n=== Final Solution ===');
  console.log(result.solution);
  console.log(`\nFinal Quality: ${result.quality.toFixed(2)}`);
  console.log(`Confidence: ${result.confidence.toFixed(2)}`);
  console.log(`Iterations: ${result.iterations}`);
  console.log(`Tokens Used: ${result.tokensUsed}`);
  console.log(`Stopping Reason: ${result.stoppingReason}`);
}

/**
 * Example 6: Debugging with Extended Thinking
 */
async function example6_DebuggingSession() {
  console.log('\n=== Example 6: Debugging with Extended Thinking ===\n');

  const agent = new ReflectionAgentV3(
    provider,
    {
      enableCodebaseContext: true,
      thinkingConfig: {
        maxCycles: 15,
      },
    },
    undefined,
    new ContextTool()
  );

  const bugReport = `
    Issue: Memory leak in the event listener cleanup
    File: src/components/MessageList.vue
    Symptoms: Memory usage increases over time
    Expected: Event listeners should be properly cleaned up
  `;

  const result = await agent.execute(`
    Debug this issue:
    ${bugReport}

    Analyze the code, identify the root cause, and provide a fix.
  `);

  console.log('=== Analysis & Fix ===');
  console.log(result.output);
}

/**
 * Example 7: Performance Optimization
 */
async function example7_PerformanceOptimization() {
  console.log('\n=== Example 7: Performance Optimization ===\n');

  const agent = new ReflectionAgentV3(provider, {
    enableWebSearch: true,
    enableParallelThinking: true,
  });

  const result = await agent.execute(`
    Optimize this slow database query for a user dashboard:

    SELECT users.*, COUNT(posts.id) as post_count
    FROM users
    LEFT JOIN posts ON users.id = posts.user_id
    WHERE users.active = true
    GROUP BY users.id
    ORDER BY post_count DESC
    LIMIT 20;

    The users table has 1M rows, posts table has 10M rows.
    Provide optimized query and explain the improvements.
  `);

  console.log('=== Optimization ===');
  console.log(result.output);
}

/**
 * Example 8: Local Model with Extended Iterations
 */
async function example8_LocalModelWithIterations() {
  console.log('\n=== Example 8: Local Model (Ollama) ===\n');

  // For local models, increase iterations to compensate for lower quality
  const localProvider = llmManager.getProvider('ollama');

  const agent = new ReflectionAgentV3(localProvider, {
    thinkingConfig: {
      maxCycles: 30,           // More cycles for local models
      minQuality: 0.85,        // Slightly lower quality threshold
      maxThinkingTokens: 8000, // Smaller context for local
    },
    enableWebSearch: false,    // Offline mode
  });

  const result = await agent.execute(
    "Write a Python function to find the longest palindromic substring"
  );

  console.log('=== Result (Local Model) ===');
  console.log(result.output);
  console.log(`Iterations: ${result.metadata.iterations}`);
}

/**
 * Main: Run all examples
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Extended Thinking System Examples    ║');
  console.log('╚════════════════════════════════════════╝\n');

  const examples = [
    example1_AdvancedCodeGeneration,
    example2_ArchitectureDecision,
    example3_ReActProblemSolving,
    example4_DeepResearch,
    example5_CustomIterationControl,
    example6_DebuggingSession,
    example7_PerformanceOptimization,
    example8_LocalModelWithIterations,
  ];

  // Run specific example or all
  const exampleToRun = process.argv[2];

  if (exampleToRun) {
    const index = parseInt(exampleToRun) - 1;
    if (index >= 0 && index < examples.length) {
      await examples[index]();
    } else {
      console.error(`Invalid example number. Choose 1-${examples.length}`);
    }
  } else {
    console.log('Running all examples... (this may take a while)\n');
    for (let i = 0; i < examples.length; i++) {
      try {
        await examples[i]();
        console.log('\n' + '─'.repeat(60) + '\n');
      } catch (error) {
        console.error(`Error in example ${i + 1}:`, error);
      }
    }
  }

  console.log('\n✅ Examples completed!\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_AdvancedCodeGeneration,
  example2_ArchitectureDecision,
  example3_ReActProblemSolving,
  example4_DeepResearch,
  example5_CustomIterationControl,
  example6_DebuggingSession,
  example7_PerformanceOptimization,
  example8_LocalModelWithIterations,
};
