/**
 * Core type definitions for Duker
 */

// ============================================
// Security Layer Types
// ============================================

export enum RiskLevel {
  SAFE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export type PermissionScope = 'once' | 'session' | 'always' | 'never'

export type OperationType =
  | 'shell'
  | 'file-read'
  | 'file-write'
  | 'file-delete'
  | 'network'
  | 'package'
  | 'env'

export interface Operation {
  type: OperationType
  action: string
  target: string
  riskLevel: RiskLevel
  description: string
  metadata?: Record<string, any>
}

export interface PermissionRequest {
  id: string
  operation: Operation
  agent: string
  context: string
  timestamp: number
  alternatives?: string[]
}

export interface PermissionDecision {
  granted: boolean
  scope: PermissionScope
  expiresAt?: number
  conditions?: PermissionCondition[]
}

export interface PermissionCondition {
  type: 'path' | 'command' | 'time' | 'size'
  constraint: any
}

export interface StoredPermission {
  operation: Operation
  decision: PermissionDecision
  createdAt: number
  usageCount: number
  lastUsed: number
}

// ============================================
// MCP Tool Types
// ============================================

export interface MCPTool {
  name: string
  description: string
  schema: ToolSchema
  execute(params: any): Promise<ToolResult>
}

export interface ToolSchema {
  parameters: Record<string, ParameterDef>
  required: string[]
}

export interface ParameterDef {
  type: string
  description: string
  optional?: boolean
}

export interface ToolResult {
  success: boolean
  data: any
  error?: string
  metadata?: Record<string, any>
}

// Shell Tool
export interface ShellParams {
  command: string
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  shell?: string
}

export interface ShellResult extends ToolResult {
  data: {
    stdout: string
    stderr: string
    exitCode: number
    duration: number
  }
}

// Context Tool
export interface FileContent {
  path: string
  content: string
  language: string
  size: number
  lastModified: Date
}

export interface CodeAnalysis {
  language: string
  imports: string[]
  exports: string[]
  functions: FunctionInfo[]
  classes: ClassInfo[]
  complexity: number
  loc: number
  comments: number
}

export interface FunctionInfo {
  name: string
  parameters: { name: string; type?: string }[]
  returnType?: string
  async?: boolean
}

export interface ClassInfo {
  name: string
  methods: string[]
  properties: string[]
}

// ============================================
// LLM Provider Types
// ============================================

export interface LLMProvider {
  name: string
  models: ModelConfig[]
  generate(request: GenerateRequest): Promise<GenerateResponse>
  stream(request: GenerateRequest): AsyncIterable<StreamChunk>
  generateWithTools?(request: ToolRequest): Promise<ToolResponse>
}

export interface ModelConfig {
  id: string
  name: string
  contextWindow: number
  strengths: string[]
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateRequest {
  messages: Message[]
  model?: string
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
  topP?: number
}

export interface GenerateResponse {
  text: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: 'stop' | 'length' | 'content-filter' | 'error'
}

export interface StreamChunk {
  content: string
  done: boolean
}

export interface ToolRequest extends GenerateRequest {
  tools: any[]
  maxSteps?: number
}

export interface ToolResponse extends GenerateResponse {
  toolCalls: any[]
  toolResults: any[]
}

// ============================================
// Agent Types
// ============================================

export type AgenticPattern =
  | 'direct'
  | 'reflection'
  | 'tool-use'
  | 'react'
  | 'planning'
  | 'multi-agent'

export interface TaskInput {
  task: string
  context?: any
  user?: string
}

export interface TaskAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'very-complex'
  type: TaskType
  requiresTools: boolean
  requiresReasoning: boolean
  requiresMultiModal: boolean
  contextSize: number
  estimatedSteps: number
}

export type TaskType =
  | 'code-generation'
  | 'code-analysis'
  | 'debugging'
  | 'refactoring'
  | 'documentation'
  | 'research'
  | 'multi-step'

export interface AgentResponse {
  success: boolean
  output: string
  metadata?: {
    agent: string
    pattern: AgenticPattern
    iterations?: number
    toolsUsed?: string[]
    tokensUsed?: number
    duration?: number
  }
  error?: string
  userCancelled?: boolean
}

// ============================================
// UI Types
// ============================================

export type UIMode = 'input' | 'processing' | 'streaming' | 'result' | 'permission' | 'error'

export interface UIState {
  mode: UIMode
  input: string
  currentAgent?: string
  processingStatus?: string
  streamContent: string
  result?: any
  error?: Error
  permissionRequest?: PermissionRequest
  metrics: {
    tokensUsed: number
    cost: number
    duration: number
  }
}

// ============================================
// Configuration Types
// ============================================

export interface DukerConfig {
  llm: {
    defaultProvider: string
    defaultModel: string
    providers: {
      anthropic?: { apiKey: string; defaultModel: string }
      openai?: { apiKey: string; defaultModel: string }
      google?: { apiKey: string; defaultModel: string }
    }
  }
  security: {
    defaultScopes: Record<RiskLevel, PermissionScope>
    blacklist: RegExp[]
    whitelist: Record<string, string[]>
    audit: {
      enabled: boolean
      logFile: string
      maxLogs: number
    }
  }
  ui: {
    theme: 'dark' | 'light'
    showTokenCount: boolean
    showCost: boolean
  }
}

// ============================================
// Error Types
// ============================================

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

export class ToolExecutionError extends Error {
  constructor(message: string, public tool: string) {
    super(message)
    this.name = 'ToolExecutionError'
  }
}

export class LLMError extends Error {
  constructor(message: string, public provider: string) {
    super(message)
    this.name = 'LLMError'
  }
}
