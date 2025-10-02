# MCP Tools Specification

## Overview

Model Context Protocol (MCP) tools provide standardized interfaces for agents to interact with external systems. Duker implements four core MCP tools: Shell, Web Search, Context, and RAG.

## MCP Architecture

```typescript
interface MCPTool {
  name: string
  description: string
  schema: ToolSchema
  execute(params: any): Promise<ToolResult>
}

interface ToolSchema {
  parameters: Record<string, ParameterDef>
  required: string[]
}

interface ToolResult {
  success: boolean
  data: any
  error?: string
  metadata?: Record<string, any>
}
```

## Security Integration

All MCP tools are wrapped with security layer for permission management:

```typescript
class SecureToolWrapper implements MCPTool {
  constructor(
    private tool: MCPTool,
    private permissionManager: PermissionManager,
    private agentId: string
  ) {}

  async execute(params: any): Promise<ToolResult> {
    // 1. Assess operation risk
    const operation = this.createOperation(params)

    // 2. Request permission
    const decision = await this.permissionManager.requestPermission({
      id: `${this.tool.name}-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: this.getOperationContext(params),
      timestamp: Date.now()
    })

    // 3. Execute if granted
    if (!decision.granted) {
      throw new PermissionDeniedError(
        `Permission denied for ${this.tool.name} operation`
      )
    }

    // 4. Execute tool
    return await this.tool.execute(params)
  }

  private createOperation(params: any): Operation {
    // Tool-specific operation creation
    // See individual tool sections below
  }

  private getOperationContext(params: any): string {
    return `${this.tool.name} operation requested by ${this.agentId}`
  }
}
```

## Shell Tool

### Overview

Execute terminal commands and scripts safely within controlled permissions.

### Interface

```typescript
interface ShellTool extends MCPTool {
  name: 'shell'
  description: 'Execute terminal commands and scripts'

  execute(params: ShellParams): Promise<ShellResult>
  executeAsync(params: ShellParams): Promise<ShellProcess>
  kill(processId: string): Promise<void>
}

interface ShellParams {
  command: string
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  shell?: string
}

interface ShellResult extends ToolResult {
  data: {
    stdout: string
    stderr: string
    exitCode: number
    duration: number
  }
}

interface ShellProcess {
  id: string
  status: 'running' | 'completed' | 'failed'
  output: AsyncIterable<string>
}
```

### Implementation

```typescript
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

class ShellToolImpl implements ShellTool {
  name = 'shell'
  description = 'Execute terminal commands'

  private permissions = {
    allowedCommands: ['npm', 'git', 'node', 'cat', 'ls', 'grep', 'find'],
    restrictedPaths: ['/etc', '/sys', '/root', '/boot'],
    maxTimeout: 60000 // 60 seconds
  }

  async execute(params: ShellParams): Promise<ShellResult> {
    // Validate command
    this.validateCommand(params.command)

    const startTime = Date.now()

    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd: params.cwd,
        env: { ...process.env, ...params.env },
        timeout: params.timeout || 30000,
        shell: params.shell || '/bin/bash'
      })

      return {
        success: true,
        data: {
          stdout,
          stderr,
          exitCode: 0,
          duration: Date.now() - startTime
        }
      }
    } catch (error: any) {
      return {
        success: false,
        data: {
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          exitCode: error.code || 1,
          duration: Date.now() - startTime
        },
        error: error.message
      }
    }
  }

  async executeAsync(params: ShellParams): Promise<ShellProcess> {
    this.validateCommand(params.command)

    const [cmd, ...args] = params.command.split(' ')
    const process = spawn(cmd, args, {
      cwd: params.cwd,
      env: { ...process.env, ...params.env },
      shell: true
    })

    const processId = `shell-${Date.now()}`

    return {
      id: processId,
      status: 'running',
      output: this.streamOutput(process)
    }
  }

  private async *streamOutput(process: any): AsyncIterable<string> {
    for await (const chunk of process.stdout) {
      yield chunk.toString()
    }
  }

  private validateCommand(command: string): void {
    // NOTE: This is a basic validation. The SecurityLayer handles
    // comprehensive permission checks before execution.

    // Check for dangerous commands
    const dangerous = ['rm -rf /', 'dd if=', '> /dev/sda', 'mkfs', ':(){:|:&};:']

    if (dangerous.some(d => command.includes(d))) {
      throw new Error('Dangerous command detected')
    }

    // Check if command is in allowed list
    const cmdName = command.split(' ')[0]
    if (!this.permissions.allowedCommands.includes(cmdName)) {
      throw new Error(`Command '${cmdName}' not in allowed list`)
    }

    // Check for restricted paths
    if (this.permissions.restrictedPaths.some(p => command.includes(p))) {
      throw new Error('Command accesses restricted path')
    }
  }
}
```

### Usage Examples

```typescript
// Simple command
const result = await shellTool.execute({
  command: 'npm test'
})

// With environment variables
const result = await shellTool.execute({
  command: 'node script.js',
  env: { NODE_ENV: 'production' }
})

// Async execution with streaming
const process = await shellTool.executeAsync({
  command: 'npm run build'
})

for await (const output of process.output) {
  console.log(output)
}
```

## Web Search Tool

### Overview

Search the web for current information using multiple search providers.

### Interface

```typescript
interface WebSearchTool extends MCPTool {
  name: 'web-search'
  description: 'Search the web for information'

  search(params: SearchParams): Promise<SearchResult>
  searchNews(params: NewsParams): Promise<NewsResult>
  searchCode(params: CodeSearchParams): Promise<CodeSearchResult>
}

interface SearchParams {
  query: string
  maxResults?: number
  dateRange?: 'day' | 'week' | 'month' | 'year' | 'all'
  language?: string
  region?: string
}

interface SearchResult extends ToolResult {
  data: {
    results: WebPage[]
    totalResults: number
    searchTime: number
  }
}

interface WebPage {
  title: string
  url: string
  snippet: string
  date?: string
  domain: string
  relevanceScore?: number
}
```

### Implementation

```typescript
class WebSearchToolImpl implements WebSearchTool {
  name = 'web-search'
  description = 'Search the web'

  private providers = {
    primary: 'tavily',    // Fast, AI-optimized search
    fallback: 'serper'    // Google search API
  }

  async search(params: SearchParams): Promise<SearchResult> {
    try {
      return await this.searchWithProvider(params, this.providers.primary)
    } catch (error) {
      console.warn('Primary search failed, trying fallback...')
      return await this.searchWithProvider(params, this.providers.fallback)
    }
  }

  private async searchWithProvider(
    params: SearchParams,
    provider: string
  ): Promise<SearchResult> {
    const startTime = Date.now()

    // Call search API (Tavily example)
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query: params.query,
        max_results: params.maxResults || 5,
        search_depth: 'advanced',
        include_answer: true
      })
    })

    const data = await response.json()

    return {
      success: true,
      data: {
        results: data.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          relevanceScore: r.score
        })),
        totalResults: data.results.length,
        searchTime: Date.now() - startTime
      }
    }
  }

  async searchNews(params: NewsParams): Promise<NewsResult> {
    return await this.search({
      ...params,
      query: `${params.query} latest news`,
      dateRange: 'week'
    })
  }

  async searchCode(params: CodeSearchParams): Promise<CodeSearchResult> {
    // Search GitHub, Stack Overflow, etc.
    const ghResults = await this.searchGitHub(params.query)
    const soResults = await this.searchStackOverflow(params.query)

    return {
      success: true,
      data: {
        github: ghResults,
        stackoverflow: soResults
      }
    }
  }

  private async searchGitHub(query: string): Promise<CodeResult[]> {
    const response = await fetch(
      `https://api.github.com/search/code?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`
        }
      }
    )

    const data = await response.json()

    return data.items.map((item: any) => ({
      repository: item.repository.full_name,
      path: item.path,
      url: item.html_url,
      snippet: item.text_matches?.[0]?.fragment
    }))
  }

  private async searchStackOverflow(query: string): Promise<SOResult[]> {
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?` +
      `q=${encodeURIComponent(query)}&site=stackoverflow&filter=withbody`
    )

    const data = await response.json()

    return data.items.map((item: any) => ({
      title: item.title,
      url: item.link,
      score: item.score,
      answered: item.is_answered,
      excerpt: item.body_markdown?.substring(0, 200)
    }))
  }
}
```

### Usage Examples

```typescript
// General web search
const results = await webSearchTool.search({
  query: 'Vue 3 composition API best practices',
  maxResults: 5,
  dateRange: 'year'
})

// News search
const news = await webSearchTool.searchNews({
  query: 'TypeScript 5.0',
  maxResults: 10
})

// Code search
const code = await webSearchTool.searchCode({
  query: 'WebRTC implementation TypeScript',
  language: 'typescript'
})
```

## Context Tool

### Overview

Analyze codebases, read files, understand structure, and provide code intelligence.

### Interface

```typescript
interface ContextTool extends MCPTool {
  name: 'context'
  description: 'Codebase analysis and understanding'

  readFile(path: string): Promise<FileContent>
  findFiles(pattern: string): Promise<string[]>
  analyzeCode(path: string): Promise<CodeAnalysis>
  getSymbols(path: string): Promise<Symbol[]>
  findReferences(symbol: string): Promise<Reference[]>
  getDependencies(path: string): Promise<Dependency[]>
}

interface FileContent {
  path: string
  content: string
  language: string
  size: number
  lastModified: Date
}

interface CodeAnalysis {
  language: string
  imports: Import[]
  exports: Export[]
  functions: FunctionInfo[]
  classes: ClassInfo[]
  complexity: number
  loc: number
  comments: number
}

interface Symbol {
  name: string
  type: 'function' | 'class' | 'variable' | 'type'
  location: Location
  signature?: string
}
```

### Implementation

```typescript
import { readFile, stat } from 'fs/promises'
import { glob } from 'glob'
import * as ts from 'typescript'

class ContextToolImpl implements ContextTool {
  name = 'context'
  description = 'Codebase analysis'

  private languageDetector = {
    '.ts': 'typescript',
    '.js': 'javascript',
    '.vue': 'vue',
    '.py': 'python',
    '.go': 'go'
  }

  async readFile(path: string): Promise<FileContent> {
    const content = await readFile(path, 'utf-8')
    const stats = await stat(path)
    const ext = path.substring(path.lastIndexOf('.'))

    return {
      path,
      content,
      language: this.languageDetector[ext] || 'unknown',
      size: stats.size,
      lastModified: stats.mtime
    }
  }

  async findFiles(pattern: string): Promise<string[]> {
    return await glob(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
    })
  }

  async analyzeCode(path: string): Promise<CodeAnalysis> {
    const file = await this.readFile(path)

    if (file.language === 'typescript' || file.language === 'javascript') {
      return this.analyzeTypeScript(file.content)
    }

    // Add other language analyzers
    throw new Error(`Analysis not supported for ${file.language}`)
  }

  private analyzeTypeScript(code: string): CodeAnalysis {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.Latest,
      true
    )

    const analysis: CodeAnalysis = {
      language: 'typescript',
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      complexity: 0,
      loc: code.split('\n').length,
      comments: 0
    }

    const visit = (node: ts.Node) => {
      // Extract imports
      if (ts.isImportDeclaration(node)) {
        analysis.imports.push({
          module: (node.moduleSpecifier as ts.StringLiteral).text,
          named: this.extractNamedImports(node)
        })
      }

      // Extract exports
      if (ts.isExportDeclaration(node)) {
        analysis.exports.push({
          name: this.extractExportName(node),
          type: 'named'
        })
      }

      // Extract functions
      if (ts.isFunctionDeclaration(node) && node.name) {
        analysis.functions.push({
          name: node.name.text,
          parameters: node.parameters.map(p => ({
            name: (p.name as ts.Identifier).text,
            type: p.type?.getText()
          })),
          returnType: node.type?.getText(),
          async: node.modifiers?.some(
            m => m.kind === ts.SyntaxKind.AsyncKeyword
          )
        })
      }

      // Extract classes
      if (ts.isClassDeclaration(node) && node.name) {
        analysis.classes.push({
          name: node.name.text,
          methods: this.extractMethods(node),
          properties: this.extractProperties(node)
        })
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    return analysis
  }

  async getSymbols(path: string): Promise<Symbol[]> {
    const analysis = await this.analyzeCode(path)

    const symbols: Symbol[] = []

    // Add functions as symbols
    analysis.functions.forEach(fn => {
      symbols.push({
        name: fn.name,
        type: 'function',
        location: { file: path, line: 0 },
        signature: `${fn.name}(${fn.parameters.map(p => p.name).join(', ')})`
      })
    })

    // Add classes as symbols
    analysis.classes.forEach(cls => {
      symbols.push({
        name: cls.name,
        type: 'class',
        location: { file: path, line: 0 }
      })
    })

    return symbols
  }

  async findReferences(symbol: string): Promise<Reference[]> {
    // Search all files for symbol usage
    const files = await this.findFiles('**/*.{ts,js,vue}')

    const references: Reference[] = []

    for (const file of files) {
      const content = await this.readFile(file)
      const lines = content.content.split('\n')

      lines.forEach((line, index) => {
        if (line.includes(symbol)) {
          references.push({
            file,
            line: index + 1,
            column: line.indexOf(symbol),
            context: line.trim()
          })
        }
      })
    }

    return references
  }

  async getDependencies(path: string): Promise<Dependency[]> {
    const analysis = await this.analyzeCode(path)

    return analysis.imports.map(imp => ({
      name: imp.module,
      version: 'unknown', // Would need to parse package.json
      type: imp.module.startsWith('.') ? 'local' : 'external'
    }))
  }

  private extractNamedImports(node: ts.ImportDeclaration): string[] {
    // TypeScript AST traversal to extract named imports
    return []
  }

  private extractExportName(node: ts.ExportDeclaration): string {
    return 'unknown'
  }

  private extractMethods(node: ts.ClassDeclaration): MethodInfo[] {
    return []
  }

  private extractProperties(node: ts.ClassDeclaration): PropertyInfo[] {
    return []
  }
}
```

### Usage Examples

```typescript
// Read file
const file = await contextTool.readFile('src/components/App.vue')

// Find files matching pattern
const tsFiles = await contextTool.findFiles('src/**/*.ts')

// Analyze code
const analysis = await contextTool.analyzeCode('src/utils/helpers.ts')

// Get all symbols
const symbols = await contextTool.getSymbols('src/router/index.ts')

// Find all usages of a function
const refs = await contextTool.findReferences('createRouter')
```

## RAG Tool

### Overview

Retrieval-Augmented Generation tool for semantic search and document retrieval using vector databases.

### Interface

```typescript
interface RAGTool extends MCPTool {
  name: 'rag'
  description: 'Semantic search and document retrieval'

  index(params: IndexParams): Promise<IndexResult>
  query(params: QueryParams): Promise<QueryResult>
  delete(params: DeleteParams): Promise<void>
  update(params: UpdateParams): Promise<void>
}

interface IndexParams {
  documents: Document[]
  collection?: string
  metadata?: Record<string, any>
}

interface QueryParams {
  query: string
  topK?: number
  filter?: Record<string, any>
  collection?: string
}

interface QueryResult extends ToolResult {
  data: {
    results: Document[]
    scores: number[]
    totalFound: number
  }
}

interface Document {
  id: string
  content: string
  metadata: Record<string, any>
  embedding?: number[]
}
```

### Implementation

```typescript
import { ChromaClient } from 'chromadb'
import { embed } from '@ai-sdk/openai'

class RAGToolImpl implements RAGTool {
  name = 'rag'
  description = 'Semantic search with vector database'

  private client: ChromaClient
  private embeddingModel = 'text-embedding-3-small'

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    })
  }

  async index(params: IndexParams): Promise<IndexResult> {
    const collection = await this.getOrCreateCollection(
      params.collection || 'default'
    )

    // Generate embeddings
    const embeddings = await Promise.all(
      params.documents.map(doc => this.generateEmbedding(doc.content))
    )

    // Add to vector database
    await collection.add({
      ids: params.documents.map(d => d.id),
      embeddings,
      documents: params.documents.map(d => d.content),
      metadatas: params.documents.map(d => d.metadata)
    })

    return {
      success: true,
      data: {
        indexed: params.documents.length,
        collection: params.collection || 'default'
      }
    }
  }

  async query(params: QueryParams): Promise<QueryResult> {
    const collection = await this.getOrCreateCollection(
      params.collection || 'default'
    )

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(params.query)

    // Search vector database
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: params.topK || 5,
      where: params.filter
    })

    return {
      success: true,
      data: {
        results: results.documents[0].map((doc, i) => ({
          id: results.ids[0][i],
          content: doc,
          metadata: results.metadatas[0][i] || {},
          relevanceScore: results.distances?.[0][i]
        })),
        scores: results.distances?.[0] || [],
        totalFound: results.documents[0].length
      }
    }
  }

  async delete(params: DeleteParams): Promise<void> {
    const collection = await this.getOrCreateCollection(
      params.collection || 'default'
    )

    await collection.delete({
      ids: params.ids
    })
  }

  async update(params: UpdateParams): Promise<void> {
    // Delete old, index new
    await this.delete({ collection: params.collection, ids: [params.id] })
    await this.index({
      collection: params.collection,
      documents: [params.document]
    })
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: openai.embedding(this.embeddingModel),
      value: text
    })

    return embedding
  }

  private async getOrCreateCollection(name: string) {
    try {
      return await this.client.getCollection({ name })
    } catch {
      return await this.client.createCollection({ name })
    }
  }
}
```

### Usage Examples

```typescript
// Index documentation
await ragTool.index({
  collection: 'vue-docs',
  documents: [
    {
      id: 'vue-composition-api',
      content: 'Vue 3 Composition API allows...',
      metadata: { category: 'api', version: '3.0' }
    }
  ]
})

// Query for relevant docs
const results = await ragTool.query({
  query: 'How to use reactive refs in Vue 3?',
  topK: 3,
  collection: 'vue-docs'
})

// Filter by metadata
const filtered = await ragTool.query({
  query: 'composition api',
  filter: { category: 'api', version: '3.0' }
})
```

## Tool Integration with Vercel AI SDK

```typescript
import { tool } from 'ai'
import { z } from 'zod'

// Define tools for AI SDK
const tools = {
  shell: tool({
    description: 'Execute shell commands',
    parameters: z.object({
      command: z.string(),
      cwd: z.string().optional()
    }),
    execute: async ({ command, cwd }) => {
      return await shellTool.execute({ command, cwd })
    }
  }),

  webSearch: tool({
    description: 'Search the web',
    parameters: z.object({
      query: z.string(),
      maxResults: z.number().optional()
    }),
    execute: async ({ query, maxResults }) => {
      return await webSearchTool.search({ query, maxResults })
    }
  }),

  readFile: tool({
    description: 'Read a file from the codebase',
    parameters: z.object({
      path: z.string()
    }),
    execute: async ({ path }) => {
      return await contextTool.readFile(path)
    }
  }),

  semanticSearch: tool({
    description: 'Search documentation semantically',
    parameters: z.object({
      query: z.string(),
      topK: z.number().optional()
    }),
    execute: async ({ query, topK }) => {
      return await ragTool.query({ query, topK })
    }
  })
}
```

## Security Layer Integration

All MCP tools MUST be wrapped with the Security Layer before use:

```typescript
// Example: Creating secure tools
const permissionManager = new PermissionManager()

const secureTools = {
  shell: new SecureToolWrapper(
    new ShellToolImpl(),
    permissionManager,
    'agent-id'
  ),
  webSearch: new SecureToolWrapper(
    new WebSearchToolImpl(),
    permissionManager,
    'agent-id'
  ),
  context: new SecureToolWrapper(
    new ContextToolImpl(),
    permissionManager,
    'agent-id'
  ),
  rag: new SecureToolWrapper(
    new RAGToolImpl(),
    permissionManager,
    'agent-id'
  )
}
```

### Risk Assessment by Tool

| Tool | Operation | Risk Level | Permission Scope |
|------|-----------|------------|------------------|
| Shell | Read-only commands (ls, git status) | LOW | Session |
| Shell | Build commands (npm run) | MEDIUM | Once |
| Shell | Install packages | HIGH | Once |
| Shell | System commands (rm, sudo) | CRITICAL | Once |
| Context | Read source files | SAFE | Always |
| Context | Read config files | LOW | Session |
| Context | Write files | MEDIUM | Once |
| Context | Delete files | HIGH | Once |
| Web Search | Any search | LOW | Session |
| RAG | Query | SAFE | Always |
| RAG | Index/Write | LOW | Session |

See [Security Layer](./security-layer.md) for complete permission system details.

## Best Practices

1. **Security First**: Always wrap tools with SecurityLayer before use
2. **Validate Inputs**: Validate all inputs, restrict dangerous operations
3. **Error Handling**: Graceful failures with detailed error messages
4. **Timeouts**: Set reasonable timeouts for all operations
5. **Caching**: Cache expensive operations (embeddings, file reads)
6. **Permission Requests**: Request user permission for risky operations
7. **Monitoring**: Track tool usage and performance
8. **Rate Limiting**: Prevent abuse of external APIs
9. **Audit Logging**: Log all tool executions for security audit
10. **Fallbacks**: Have backup strategies for tool failures
