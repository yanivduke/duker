# Tool Use Pattern Specification

## Overview

The Tool Use Pattern enables agents to extend their capabilities by invoking external tools, APIs, and services. This pattern is fundamental for accessing real-time data, executing commands, and performing actions beyond the LLM's native capabilities.

## Core Concept

```
User Input → Agent Reasoning → Tool Selection → Tool Execution → Result Integration → Response
```

The agent identifies when it needs external information or capabilities, selects appropriate tools, executes them, and integrates results into its response.

## Architecture

```typescript
interface ToolUseAgent {
  identifyTools(input: TaskInput): Promise<Tool[]>
  executeTool(tool: Tool, params: ToolParams): Promise<ToolResult>
  integrateResults(results: ToolResult[]): Promise<Response>
  execute(input: TaskInput): Promise<Response>
}
```

## MCP Tool Definitions

### Shell Tool
```typescript
interface ShellTool {
  name: 'shell'
  description: 'Execute terminal commands and scripts'

  execute(params: {
    command: string
    cwd?: string
    env?: Record<string, string>
    timeout?: number
  }): Promise<{
    stdout: string
    stderr: string
    exitCode: number
  }>
}
```

### Web Search Tool
```typescript
interface WebSearchTool {
  name: 'web-search'
  description: 'Search the web for current information'

  execute(params: {
    query: string
    maxResults?: number
    dateRange?: 'day' | 'week' | 'month' | 'year' | 'all'
  }): Promise<{
    results: SearchResult[]
    totalResults: number
  }>
}

interface SearchResult {
  title: string
  url: string
  snippet: string
  date?: string
}
```

### Context Tool
```typescript
interface ContextTool {
  name: 'context'
  description: 'Analyze codebase, read files, understand structure'

  readFile(path: string): Promise<string>
  findFiles(pattern: string): Promise<string[]>
  analyzeCode(path: string): Promise<CodeAnalysis>
  getSymbols(path: string): Promise<Symbol[]>
}

interface CodeAnalysis {
  language: string
  imports: string[]
  exports: string[]
  functions: FunctionInfo[]
  classes: ClassInfo[]
  complexity: number
}
```

### RAG Tool
```typescript
interface RAGTool {
  name: 'rag'
  description: 'Retrieve relevant information from vector database'

  query(params: {
    query: string
    topK?: number
    filter?: Record<string, any>
  }): Promise<{
    results: Document[]
    scores: number[]
  }>

  index(params: {
    documents: Document[]
    metadata?: Record<string, any>
  }): Promise<void>
}

interface Document {
  id: string
  content: string
  metadata: Record<string, any>
  embedding?: number[]
}
```

## Tool Selection Logic

### Decision Tree

```typescript
function selectTools(input: TaskInput): Tool[] {
  const tools: Tool[] = []

  // Code-related tasks
  if (input.requiresCodeAnalysis) {
    tools.push('context')
  }

  // Needs current information
  if (input.requiresCurrentInfo) {
    tools.push('web-search')
  }

  // Needs historical knowledge
  if (input.requiresDocumentation) {
    tools.push('rag')
  }

  // Needs execution/verification
  if (input.requiresExecution) {
    tools.push('shell')
  }

  return tools
}
```

### Tool Compatibility Matrix

| Task Type | Shell | Web Search | Context | RAG |
|-----------|-------|------------|---------|-----|
| Code Generation | ✓ | - | ✓ | ✓ |
| Debugging | ✓ | ✓ | ✓ | - |
| Research | - | ✓ | - | ✓ |
| File Operations | ✓ | - | ✓ | - |
| Documentation | - | ✓ | ✓ | ✓ |
| Testing | ✓ | - | ✓ | - |

## Function Calling with Vercel AI SDK

### Tool Definition Format

```typescript
import { tool } from 'ai'

const shellTool = tool({
  description: 'Execute shell commands',
  parameters: z.object({
    command: z.string().describe('The command to execute'),
    cwd: z.string().optional().describe('Working directory'),
  }),
  execute: async ({ command, cwd }) => {
    // Execute command via MCP
    return await mcp.shell.execute({ command, cwd })
  },
})

const webSearchTool = tool({
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().optional().default(5),
  }),
  execute: async ({ query, maxResults }) => {
    return await mcp.webSearch.search({ query, maxResults })
  },
})
```

### Agent with Tools

```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  tools: {
    shell: shellTool,
    webSearch: webSearchTool,
    context: contextTool,
    rag: ragTool,
  },
  maxSteps: 5, // Allow multiple tool calls
  prompt: userInput,
})
```

## Execution Flow

### Sequential Tool Execution

```typescript
async function executeSequential(tools: Tool[]): Promise<Response> {
  let context = initialContext

  for (const tool of tools) {
    const result = await executeTool(tool, context)
    context = integrateResult(context, result)
  }

  return generateFinalResponse(context)
}
```

### Parallel Tool Execution

```typescript
async function executeParallel(tools: Tool[]): Promise<Response> {
  const results = await Promise.all(
    tools.map(tool => executeTool(tool))
  )

  const integratedContext = integrateResults(results)
  return generateFinalResponse(integratedContext)
}
```

### Conditional Tool Execution

```typescript
async function executeConditional(
  input: TaskInput
): Promise<Response> {
  // Try primary tool
  const primaryResult = await executeTool(primaryTool, input)

  // Check if additional tools needed
  if (primaryResult.needsMoreInfo) {
    const secondaryResult = await executeTool(secondaryTool, input)
    return combine(primaryResult, secondaryResult)
  }

  return primaryResult
}
```

## Error Handling

### Tool Execution Errors

```typescript
interface ToolError {
  tool: string
  error: Error
  recoverable: boolean
}

async function executeToolWithRetry(
  tool: Tool,
  params: ToolParams
): Promise<ToolResult> {
  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    try {
      return await tool.execute(params)
    } catch (error) {
      attempts++

      if (!isRecoverable(error) || attempts === maxAttempts) {
        throw new ToolError({
          tool: tool.name,
          error,
          recoverable: false
        })
      }

      await delay(1000 * attempts) // Exponential backoff
    }
  }
}
```

### Fallback Strategies

```typescript
const fallbackChain = {
  'web-search': async (query: string) => {
    try {
      return await webSearchTool.execute({ query })
    } catch {
      // Fallback to RAG if web search fails
      return await ragTool.query({ query })
    }
  },

  'context': async (path: string) => {
    try {
      return await contextTool.readFile(path)
    } catch {
      // Fallback to shell cat command
      return await shellTool.execute({ command: `cat ${path}` })
    }
  }
}
```

## Result Integration

### Context Accumulation

```typescript
interface ToolContext {
  originalInput: string
  toolResults: Map<string, ToolResult>
  intermediateAnalysis: string[]
}

function integrateToolResults(context: ToolContext): string {
  const prompt = `
    User Request: ${context.originalInput}

    Tool Results:
    ${Array.from(context.toolResults.entries()).map(([tool, result]) => `
      [${tool}]
      ${formatResult(result)}
    `).join('\n')}

    Based on these results, provide a comprehensive response.
  `

  return prompt
}
```

## Use Cases

### Case 1: Code Analysis + Web Search

```typescript
// User: "How do I implement WebRTC in Vue 3?"

// Step 1: Check existing codebase
const codeContext = await contextTool.analyzeCode('src/')

// Step 2: Search for best practices
const webResults = await webSearchTool.execute({
  query: 'WebRTC Vue 3 implementation best practices 2024'
})

// Step 3: Check documentation
const ragResults = await ragTool.query({
  query: 'WebRTC Vue 3 examples'
})

// Step 4: Generate response integrating all sources
```

### Case 2: Debugging with Shell + Context

```typescript
// User: "Why is my app crashing?"

// Step 1: Read error logs
const logs = await shellTool.execute({
  command: 'tail -n 100 app.log'
})

// Step 2: Analyze relevant code
const errorLine = extractErrorLocation(logs.stdout)
const code = await contextTool.readFile(errorLine.file)

// Step 3: Provide diagnosis
```

### Case 3: Feature Implementation

```typescript
// User: "Add user authentication"

// Step 1: Analyze existing auth code
const existingAuth = await contextTool.findFiles('**/*auth*')

// Step 2: Research current best practices
const authPatterns = await webSearchTool.execute({
  query: 'Node.js authentication best practices 2024'
})

// Step 3: Generate implementation plan
```

## Tool Composition Patterns

### Pipeline Pattern

```typescript
const result = await pipeline([
  { tool: 'context', params: { pattern: '**/*.ts' } },
  { tool: 'rag', params: { query: 'TypeScript patterns' } },
  { tool: 'shell', params: { command: 'npm test' } }
])
```

### Map-Reduce Pattern

```typescript
// Map: Execute tool on multiple inputs
const files = ['a.ts', 'b.ts', 'c.ts']
const analyses = await Promise.all(
  files.map(file => contextTool.analyzeCode(file))
)

// Reduce: Combine results
const summary = analyses.reduce((acc, analysis) => {
  return mergeAnalyses(acc, analysis)
}, {})
```

### Conditional Chain Pattern

```typescript
let result = await webSearchTool.execute({ query })

if (result.totalResults === 0) {
  result = await ragTool.query({ query })
}

if (needsVerification(result)) {
  const verification = await shellTool.execute({
    command: buildVerificationCommand(result)
  })
  result = combine(result, verification)
}
```

## Performance Optimization

### Caching

```typescript
const toolCache = new Map<string, ToolResult>()

async function executeCached(
  tool: Tool,
  params: ToolParams
): Promise<ToolResult> {
  const cacheKey = `${tool.name}:${JSON.stringify(params)}`

  if (toolCache.has(cacheKey)) {
    return toolCache.get(cacheKey)!
  }

  const result = await tool.execute(params)
  toolCache.set(cacheKey, result)

  return result
}
```

### Parallel Execution

```typescript
// Execute independent tools in parallel
const [searchResults, codeAnalysis] = await Promise.all([
  webSearchTool.execute({ query }),
  contextTool.analyzeCode(filePath)
])
```

### Early Termination

```typescript
// Stop if sufficient information gathered
async function executeUntilSufficient(
  tools: Tool[]
): Promise<ToolResult[]> {
  const results: ToolResult[] = []

  for (const tool of tools) {
    const result = await tool.execute()
    results.push(result)

    if (isSufficient(results)) {
      break
    }
  }

  return results
}
```

## Security Considerations

### Command Sanitization

```typescript
function sanitizeCommand(command: string): string {
  // Remove dangerous characters and commands
  const dangerous = ['rm -rf', '> /dev/sda', 'dd if=']

  if (dangerous.some(d => command.includes(d))) {
    throw new Error('Dangerous command detected')
  }

  return command
}
```

### Permission Checks

```typescript
const permissions = {
  shell: {
    allowedCommands: ['npm', 'git', 'node', 'cat', 'ls'],
    restrictedPaths: ['/etc', '/sys', '/root']
  },
  context: {
    allowedPaths: ['./src', './docs'],
    maxFileSize: 1024 * 1024 // 1MB
  }
}
```

## Monitoring & Metrics

```typescript
interface ToolMetrics {
  toolName: string
  executionCount: number
  averageLatency: number
  errorRate: number
  cacheHitRate: number
  popularParameters: Record<string, number>
}
```

## Best Practices

1. **Tool Selection**: Choose minimal necessary tools
2. **Parallel Execution**: Run independent tools concurrently
3. **Error Handling**: Always have fallback strategies
4. **Caching**: Cache expensive tool operations
5. **Security**: Validate and sanitize all tool inputs
6. **Monitoring**: Track tool usage and performance
7. **Timeouts**: Set reasonable timeouts for all tools
8. **Result Validation**: Verify tool outputs before using
