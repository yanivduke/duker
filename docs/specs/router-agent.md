# Router Agent Specification

## Overview

The Router Agent is the central orchestrator in Duker's agentic architecture. It receives all user inputs and intelligently routes them to the most appropriate agent pattern(s) and LLM provider(s).

## Responsibilities

1. **Input Analysis**: Parse and understand user intent, task complexity, and requirements
2. **Pattern Selection**: Choose optimal agentic pattern(s) for the task
3. **LLM Selection**: Determine the best LLM provider/model for the workload
4. **Tool Identification**: Identify required MCP tools (shell, web search, context, RAG)
5. **Security Coordination**: Integrate with Security Layer for permission management
6. **Execution Coordination**: Orchestrate agent execution and aggregate results
7. **Error Handling**: Manage failures and fallback strategies

## Architecture

```typescript
interface RouterAgent {
  analyze(input: UserInput): TaskAnalysis
  selectPattern(analysis: TaskAnalysis): AgenticPattern[]
  selectLLM(analysis: TaskAnalysis): LLMProvider
  selectTools(analysis: TaskAnalysis): MCPTool[]
  securityLayer: SecurityLayer
  route(input: UserInput): Promise<AgentResponse>
}
```

### Security Integration

The Router Agent integrates with the Security Layer to ensure all operations are authorized:

```typescript
class SecureRouterAgent implements RouterAgent {
  constructor(
    private securityLayer: SecurityLayer,
    private permissionManager: PermissionManager
  ) {}

  async route(input: UserInput): Promise<AgentResponse> {
    // 1. Analyze input
    const analysis = await this.analyze(input)

    // 2. Select components
    const pattern = this.selectPattern(analysis)
    const llm = this.selectLLM(analysis)
    const tools = this.selectTools(analysis)

    // 3. Create secure tool instances
    const secureTools = tools.map(tool =>
      this.wrapToolWithSecurity(tool, pattern.agentId)
    )

    // 4. Execute with security
    return await this.executeSecure(pattern, llm, secureTools, input)
  }

  private wrapToolWithSecurity(tool: MCPTool, agentId: string): MCPTool {
    return new SecureToolWrapper(tool, this.permissionManager, agentId)
  }

  private async executeSecure(
    pattern: AgenticPattern,
    llm: LLMProvider,
    tools: MCPTool[],
    input: UserInput
  ): Promise<AgentResponse> {
    try {
      // Execute with security-wrapped tools
      return await pattern.execute(input, tools, llm)
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return {
          success: false,
          error: 'Operation cancelled: Permission denied by user',
          userCancelled: true
        }
      }
      throw error
    }
  }
}
```

## Input Analysis Process

### Step 1: Intent Classification

Classify user intent into categories:
- **Code Generation**: Creating new code
- **Code Analysis**: Understanding existing code
- **Debugging**: Finding and fixing issues
- **Refactoring**: Improving code structure
- **Documentation**: Generating docs/comments
- **Research**: Gathering information
- **Multi-Step**: Complex tasks requiring planning

### Step 2: Complexity Assessment

Evaluate task complexity:
- **Simple**: Single-step, straightforward tasks → Direct LLM call
- **Moderate**: 2-3 steps, some tool use → Tool Use or Reflection pattern
- **Complex**: Multi-step, requires planning → Planning or Multi-Agent pattern
- **Iterative**: Requires refinement → Reflection or ReAct pattern

### Step 3: Context Requirements

Determine what context is needed:
- **Codebase Context**: Requires file reading, analysis
- **External Knowledge**: Needs web search, documentation
- **Historical Context**: Requires conversation memory, RAG
- **Real-time Data**: Needs API calls, current information

## Pattern Selection Logic

```typescript
type PatternSelector = {
  // Simple tasks - direct execution
  simple: () => DirectLLMPattern

  // Needs verification/improvement
  iterative: () => ReflectionPattern

  // Requires external data/tools
  toolRequired: () => ToolUsePattern

  // Complex reasoning with actions
  complexReasoning: () => ReActPattern

  // Multi-step decomposition
  multiStep: () => PlanningPattern

  // Requires specialized expertise
  specialized: () => MultiAgentPattern
}
```

## LLM Provider Selection

### Selection Criteria

| Task Type | Recommended Provider | Rationale |
|-----------|---------------------|-----------|
| Complex reasoning | Anthropic Claude | Superior reasoning, long context |
| Code generation | OpenAI GPT-4 | Fast, reliable code output |
| Multi-modal | Google Gemini | Image/video understanding |
| Fast iterations | OpenAI GPT-3.5 | Speed, cost-effective |
| Long context | Anthropic Claude | 200K+ token window |

### Provider Configuration

```typescript
interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  model: string
  temperature: number
  maxTokens: number
  streaming: boolean
}
```

## Tool Selection

### MCP Tool Mapping

```typescript
const toolMapping = {
  codeAnalysis: ['context', 'rag'],
  debugging: ['shell', 'context'],
  research: ['web-search', 'rag'],
  fileOperations: ['shell', 'context'],
  documentation: ['context', 'rag', 'web-search']
}
```

## Routing Algorithm

```typescript
async function route(input: UserInput): Promise<AgentResponse> {
  // 1. Analyze input
  const analysis = await analyzeInput(input)

  // 2. Select components
  const pattern = selectPattern(analysis)
  const llm = selectLLM(analysis)
  const tools = selectTools(analysis)

  // 3. Check for parallel execution
  if (analysis.parallelizable) {
    return await executeParallel(pattern, llm, tools, input)
  }

  // 4. Sequential execution
  return await executeSequential(pattern, llm, tools, input)
}
```

## Decision Tree

```
User Input
    |
    ├─> Simple Task? ───> Direct LLM
    |
    ├─> Needs Tools? ───> Tool Use Pattern
    |
    ├─> Iterative? ─────> Reflection/ReAct Pattern
    |
    ├─> Multi-Step? ────> Planning Pattern
    |
    └─> Specialized? ───> Multi-Agent Pattern
```

## Error Handling & Fallbacks

### Retry Strategy

```typescript
interface RetryConfig {
  maxAttempts: 3
  backoffMs: [1000, 2000, 5000]
  fallbackPattern?: AgenticPattern
  fallbackLLM?: LLMProvider
}
```

### Fallback Chain

1. **Primary**: Selected pattern + selected LLM
2. **Fallback 1**: Same pattern + alternative LLM
3. **Fallback 2**: Simpler pattern + primary LLM
4. **Fallback 3**: Direct LLM call with error context

## Performance Optimization

### Caching Strategy

- Cache pattern selection for similar inputs
- Cache LLM responses for identical queries
- Cache tool results with TTL

### Parallel Execution

Identify independent subtasks for parallel execution:
```typescript
if (canParallelize(subtasks)) {
  return await Promise.all(subtasks.map(executeAgent))
}
```

## Monitoring & Telemetry

Track key metrics:
- Pattern selection distribution
- LLM usage by provider
- Average task completion time
- Error rates by pattern/LLM
- Tool usage frequency
- User satisfaction (implicit/explicit)

## API Interface

```typescript
class RouterAgent {
  constructor(config: RouterConfig)

  async route(input: UserInput): Promise<AgentResponse>
  async analyze(input: UserInput): Promise<TaskAnalysis>
  getMetrics(): RouterMetrics
  updateConfig(config: Partial<RouterConfig>): void
}
```

## Example Routing Scenarios

### Scenario 1: Simple Code Generation
```
Input: "Write a function to sort an array"
→ Pattern: Direct LLM
→ LLM: OpenAI GPT-4
→ Tools: None
```

### Scenario 2: Complex Debugging
```
Input: "Find and fix the memory leak in my application"
→ Pattern: ReAct (reason + investigate)
→ LLM: Anthropic Claude
→ Tools: [shell, context]
```

### Scenario 3: Multi-Step Feature
```
Input: "Add authentication system with JWT tokens"
→ Pattern: Planning (decompose into subtasks)
→ LLM: Anthropic Claude
→ Tools: [context, web-search, shell]
```

### Scenario 4: Research Task
```
Input: "What's the best way to implement WebRTC in Vue 3?"
→ Pattern: Tool Use
→ LLM: OpenAI GPT-4
→ Tools: [web-search, rag]
```

## Implementation Priority

1. **Phase 1**: Basic routing with pattern selection
2. **Phase 2**: LLM provider integration via AI SDK
3. **Phase 3**: Tool selection and integration
4. **Phase 4**: Parallel execution support
5. **Phase 5**: Advanced caching and optimization
