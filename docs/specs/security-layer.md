# Security Layer Specification

## Overview

The Security Layer provides a comprehensive permission system that protects users by requiring explicit consent before agents perform potentially dangerous operations. This layer integrates with all agent patterns, MCP tools, and the UI to ensure safe, controlled execution.

## Core Principles

1. **Explicit Consent**: Never execute dangerous operations without user approval
2. **Least Privilege**: Grant minimal permissions necessary
3. **Transparency**: Show exactly what will be executed
4. **Granular Control**: Per-operation and per-resource permissions
5. **Auditability**: Log all permission requests and decisions

## Permission System Architecture

```typescript
interface SecurityLayer {
  permissionManager: PermissionManager
  requestPermission(operation: Operation): Promise<PermissionDecision>
  checkPermission(operation: Operation): boolean
  revokePermission(scope: PermissionScope): void
  auditLog: AuditLogger
}

interface PermissionManager {
  permissions: PermissionStore
  requestPermission(request: PermissionRequest): Promise<PermissionDecision>
  checkPermission(operation: Operation): boolean
  updatePermission(permission: Permission): void
}
```

## Permission Levels

### Operation Risk Levels

```typescript
enum RiskLevel {
  SAFE = 0,        // Read-only, no side effects
  LOW = 1,         // Minimal impact (create files in project)
  MEDIUM = 2,      // Moderate impact (modify existing files)
  HIGH = 3,        // Significant impact (delete files, install packages)
  CRITICAL = 4     // System-level impact (run shell commands, access network)
}

interface Operation {
  type: OperationType
  action: string
  target: string
  riskLevel: RiskLevel
  description: string
  metadata?: Record<string, any>
}

type OperationType =
  | 'shell'          // Execute shell command
  | 'file-read'      // Read file
  | 'file-write'     // Create/modify file
  | 'file-delete'    // Delete file
  | 'network'        // Network access
  | 'package'        // Install/modify packages
  | 'env'            // Access environment variables
```

### Risk Level Classification

```typescript
const riskClassification = {
  // SAFE operations (auto-allow)
  safe: [
    { type: 'file-read', pattern: 'src/**/*.ts' },
    { type: 'file-read', pattern: 'docs/**/*.md' },
  ],

  // LOW risk (prompt once per session)
  low: [
    { type: 'file-write', pattern: 'src/**/*.ts', action: 'create' },
    { type: 'file-write', pattern: 'docs/**/*.md', action: 'create' },
  ],

  // MEDIUM risk (prompt each time)
  medium: [
    { type: 'file-write', pattern: 'src/**/*.ts', action: 'modify' },
    { type: 'file-delete', pattern: 'src/**/*.test.ts' },
  ],

  // HIGH risk (prompt with details)
  high: [
    { type: 'file-delete', pattern: 'src/**/*.ts' },
    { type: 'package', action: 'install' },
    { type: 'shell', command: 'npm install' },
  ],

  // CRITICAL risk (require explicit confirmation)
  critical: [
    { type: 'shell', pattern: /rm|sudo|curl|wget|dd/ },
    { type: 'file-delete', pattern: 'package.json' },
    { type: 'env', action: 'modify' },
  ]
}
```

## Permission Request Flow

```typescript
interface PermissionRequest {
  id: string
  operation: Operation
  agent: string
  context: string
  timestamp: number
  alternatives?: string[]
}

interface PermissionDecision {
  granted: boolean
  scope: PermissionScope
  expiresAt?: number
  conditions?: PermissionCondition[]
}

type PermissionScope =
  | 'once'           // Allow this specific operation once
  | 'session'        // Allow for current session
  | 'always'         // Always allow (saved to config)
  | 'never'          // Never allow (blacklist)

interface PermissionCondition {
  type: 'path' | 'command' | 'time' | 'size'
  constraint: any
}
```

## Permission Request Implementation

```typescript
class PermissionManager {
  private store: PermissionStore
  private ui: PermissionUI
  private audit: AuditLogger

  async requestPermission(
    request: PermissionRequest
  ): Promise<PermissionDecision> {
    // 1. Check existing permissions
    const existing = this.checkExistingPermission(request)
    if (existing) {
      this.audit.log({
        action: 'permission-granted',
        request,
        decision: existing,
        reason: 'existing-permission'
      })
      return existing
    }

    // 2. Auto-allow SAFE operations
    if (request.operation.riskLevel === RiskLevel.SAFE) {
      const decision: PermissionDecision = {
        granted: true,
        scope: 'always'
      }

      this.audit.log({
        action: 'permission-granted',
        request,
        decision,
        reason: 'safe-operation'
      })

      return decision
    }

    // 3. Check blacklist
    if (this.isBlacklisted(request.operation)) {
      const decision: PermissionDecision = {
        granted: false,
        scope: 'never'
      }

      this.audit.log({
        action: 'permission-denied',
        request,
        decision,
        reason: 'blacklisted'
      })

      return decision
    }

    // 4. Prompt user
    const decision = await this.ui.promptPermission(request)

    // 5. Save decision if needed
    if (decision.scope === 'always' || decision.scope === 'never') {
      this.store.savePermission(request.operation, decision)
    }

    // 6. Log decision
    this.audit.log({
      action: decision.granted ? 'permission-granted' : 'permission-denied',
      request,
      decision,
      reason: 'user-decision'
    })

    return decision
  }

  private checkExistingPermission(
    request: PermissionRequest
  ): PermissionDecision | null {
    return this.store.findPermission(request.operation)
  }

  private isBlacklisted(operation: Operation): boolean {
    return this.store.isBlacklisted(operation)
  }

  checkPermission(operation: Operation): boolean {
    const permission = this.store.findPermission(operation)
    return permission?.granted ?? false
  }

  revokePermission(operation: Operation): void {
    this.store.deletePermission(operation)
    this.audit.log({
      action: 'permission-revoked',
      operation
    })
  }
}
```

## Permission Storage

```typescript
interface PermissionStore {
  permissions: Map<string, StoredPermission>
  blacklist: Set<string>

  savePermission(operation: Operation, decision: PermissionDecision): void
  findPermission(operation: Operation): PermissionDecision | null
  deletePermission(operation: Operation): void
  isBlacklisted(operation: Operation): boolean
}

interface StoredPermission {
  operation: Operation
  decision: PermissionDecision
  createdAt: number
  usageCount: number
  lastUsed: number
}

class FileBasedPermissionStore implements PermissionStore {
  private configPath = '.duker/permissions.json'
  permissions: Map<string, StoredPermission> = new Map()
  blacklist: Set<string> = new Set()

  constructor() {
    this.load()
  }

  savePermission(
    operation: Operation,
    decision: PermissionDecision
  ): void {
    const key = this.createKey(operation)

    if (decision.scope === 'never') {
      this.blacklist.add(key)
    } else {
      this.permissions.set(key, {
        operation,
        decision,
        createdAt: Date.now(),
        usageCount: 0,
        lastUsed: Date.now()
      })
    }

    this.persist()
  }

  findPermission(operation: Operation): PermissionDecision | null {
    const key = this.createKey(operation)
    const stored = this.permissions.get(key)

    if (!stored) return null

    // Check if expired
    if (stored.decision.expiresAt && Date.now() > stored.decision.expiresAt) {
      this.permissions.delete(key)
      this.persist()
      return null
    }

    // Update usage stats
    stored.usageCount++
    stored.lastUsed = Date.now()
    this.persist()

    return stored.decision
  }

  deletePermission(operation: Operation): void {
    const key = this.createKey(operation)
    this.permissions.delete(key)
    this.blacklist.delete(key)
    this.persist()
  }

  isBlacklisted(operation: Operation): boolean {
    const key = this.createKey(operation)
    return this.blacklist.has(key)
  }

  private createKey(operation: Operation): string {
    return `${operation.type}:${operation.action}:${operation.target}`
  }

  private load(): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
      this.permissions = new Map(Object.entries(data.permissions || {}))
      this.blacklist = new Set(data.blacklist || [])
    } catch {
      // File doesn't exist, start fresh
    }
  }

  private persist(): void {
    const data = {
      permissions: Object.fromEntries(this.permissions),
      blacklist: Array.from(this.blacklist),
      version: '1.0',
      lastModified: new Date().toISOString()
    }

    fs.mkdirSync(path.dirname(this.configPath), { recursive: true })
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2))
  }
}
```

## UI Permission Prompts

### Permission Dialog Component

```vue
<!-- src/ui/components/PermissionDialog.vue -->
<template>
  <Box :flex-direction="'column'" :border-style="'bold'" :padding="1">
    <!-- Header with risk level -->
    <Box :margin-bottom="1">
      <Text :color="riskColor" :bold="true">
        {{ riskIcon }} Permission Required
      </Text>
    </Box>

    <!-- Agent requesting -->
    <Box :margin-bottom="1">
      <Text :color="'dim'">Agent:</Text>
      <Text :margin-left="1" :color="'cyan'">{{ request.agent }}</Text>
    </Box>

    <!-- Operation details -->
    <Box :flex-direction="'column'" :margin-bottom="1">
      <Text :color="'yellow'" :bold="true">Operation:</Text>
      <Box :margin-left="2" :margin-top="1">
        <Text :color="'white'">{{ request.operation.description }}</Text>
      </Box>
    </Box>

    <!-- What will be executed -->
    <Box :flex-direction="'column'" :margin-bottom="1">
      <Text :color="'yellow'" :bold="true">Action:</Text>
      <Box
        :margin-left="2"
        :margin-top="1}
        :border-style="'single'"
        :padding="1"
      >
        <Text :color="'white'">{{ formatAction(request.operation) }}</Text>
      </Box>
    </Box>

    <!-- Context -->
    <Box v-if="request.context" :flex-direction="'column'" :margin-bottom="1">
      <Text :color="'dim'">Context:</Text>
      <Text :margin-left="2">{{ request.context }}</Text>
    </Box>

    <!-- Risk warning -->
    <Box v-if="isHighRisk" :margin-bottom="1">
      <Text :color="'red'" :bold="true">⚠ Warning: </Text>
      <Text :color="'red'">{{ getRiskWarning() }}</Text>
    </Box>

    <!-- Options -->
    <Box :flex-direction="'column'" :margin-top="1">
      <Text :color="'cyan'" :bold="true">Choose an option:</Text>
      <Box :margin-top="1">
        <SelectInput
          :items="options"
          @select="handleSelection"
        />
      </Box>
    </Box>

    <!-- Keyboard hints -->
    <Box :margin-top="1" :border-top="true" :padding-top="1">
      <Text :color="'dim'">
        ↑/↓: Navigate  Enter: Confirm  Esc: Reject
      </Text>
    </Box>
  </Box>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text, SelectInput } from 'ink'

const props = defineProps<{
  request: PermissionRequest
}>()

const emit = defineEmits<{
  decision: [PermissionDecision]
}>()

const riskColor = computed(() => {
  const colors = {
    [RiskLevel.SAFE]: 'green',
    [RiskLevel.LOW]: 'blue',
    [RiskLevel.MEDIUM]: 'yellow',
    [RiskLevel.HIGH]: 'orange',
    [RiskLevel.CRITICAL]: 'red'
  }
  return colors[props.request.operation.riskLevel]
})

const riskIcon = computed(() => {
  const icons = {
    [RiskLevel.SAFE]: '✓',
    [RiskLevel.LOW]: 'ℹ',
    [RiskLevel.MEDIUM]: '⚠',
    [RiskLevel.HIGH]: '⚠',
    [RiskLevel.CRITICAL]: '🛑'
  }
  return icons[props.request.operation.riskLevel]
})

const isHighRisk = computed(() =>
  props.request.operation.riskLevel >= RiskLevel.HIGH
)

const options = computed(() => {
  const baseOptions = [
    {
      label: '✓ Allow Once - Execute this operation now',
      value: 'once'
    },
    {
      label: '✗ Reject - Do not execute',
      value: 'never'
    }
  ]

  // Add "Allow Always" for non-critical operations
  if (props.request.operation.riskLevel < RiskLevel.CRITICAL) {
    baseOptions.splice(1, 0, {
      label: '✓✓ Allow Always - Don\'t ask again for this operation',
      value: 'always'
    })
  }

  // Add "Allow for Session" for medium+ risk
  if (props.request.operation.riskLevel >= RiskLevel.MEDIUM) {
    baseOptions.splice(1, 0, {
      label: '✓ Allow for Session - Allow until Duker exits',
      value: 'session'
    })
  }

  return baseOptions
})

const formatAction = (operation: Operation): string => {
  switch (operation.type) {
    case 'shell':
      return `$ ${operation.action}`
    case 'file-write':
      return `Write to: ${operation.target}`
    case 'file-delete':
      return `Delete: ${operation.target}`
    case 'network':
      return `Network request to: ${operation.target}`
    default:
      return `${operation.action} ${operation.target}`
  }
}

const getRiskWarning = (): string => {
  const warnings = {
    [RiskLevel.HIGH]: 'This operation can make significant changes to your system.',
    [RiskLevel.CRITICAL]: 'This operation has system-level access and could cause damage if misused.'
  }
  return warnings[props.request.operation.riskLevel] || ''
}

const handleSelection = (item: { value: string }) => {
  const decision: PermissionDecision = {
    granted: item.value !== 'never',
    scope: item.value as PermissionScope,
    expiresAt: item.value === 'session'
      ? Date.now() + 24 * 60 * 60 * 1000  // 24 hours
      : undefined
  }

  emit('decision', decision)
}
</script>
```

## Integration with MCP Tools

### Shell Tool with Security

```typescript
class SecureShellTool implements ShellTool {
  constructor(
    private permissionManager: PermissionManager,
    private agentId: string
  ) {}

  async execute(params: ShellParams): Promise<ShellResult> {
    // 1. Create operation
    const operation: Operation = {
      type: 'shell',
      action: params.command,
      target: params.cwd || process.cwd(),
      riskLevel: this.assessRisk(params.command),
      description: `Execute shell command: ${params.command}`
    }

    // 2. Request permission
    const decision = await this.permissionManager.requestPermission({
      id: `shell-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: 'Shell command execution requested',
      timestamp: Date.now()
    })

    // 3. Check if granted
    if (!decision.granted) {
      throw new PermissionDeniedError(
        `Permission denied for command: ${params.command}`
      )
    }

    // 4. Execute with validation
    return await this.executeValidated(params)
  }

  private assessRisk(command: string): RiskLevel {
    // Critical: Dangerous commands
    if (/rm\s+-rf|sudo|curl.*\||dd\s+if=/.test(command)) {
      return RiskLevel.CRITICAL
    }

    // High: System modifications
    if (/npm\s+install|apt\s+install|brew\s+install/.test(command)) {
      return RiskLevel.HIGH
    }

    // Medium: File modifications
    if (/git\s+commit|git\s+push|npm\s+publish/.test(command)) {
      return RiskLevel.MEDIUM
    }

    // Low: Build/test commands
    if (/npm\s+test|npm\s+run|git\s+status/.test(command)) {
      return RiskLevel.LOW
    }

    // Default: Medium
    return RiskLevel.MEDIUM
  }

  private async executeValidated(params: ShellParams): Promise<ShellResult> {
    // Sanitize and execute
    const sanitized = this.sanitizeCommand(params.command)
    return await exec(sanitized, params)
  }

  private sanitizeCommand(command: string): string {
    // Remove potentially dangerous characters
    return command.replace(/[;&|`$()]/g, '')
  }
}
```

### File Operations with Security

```typescript
class SecureContextTool implements ContextTool {
  constructor(
    private permissionManager: PermissionManager,
    private agentId: string
  ) {}

  async readFile(path: string): Promise<FileContent> {
    // Read operations are generally SAFE
    const operation: Operation = {
      type: 'file-read',
      action: 'read',
      target: path,
      riskLevel: this.isSecureFile(path) ? RiskLevel.SAFE : RiskLevel.LOW,
      description: `Read file: ${path}`
    }

    const decision = await this.permissionManager.requestPermission({
      id: `read-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: `Reading file for code analysis`,
      timestamp: Date.now()
    })

    if (!decision.granted) {
      throw new PermissionDeniedError(`Permission denied to read: ${path}`)
    }

    return await fs.readFile(path, 'utf-8')
  }

  async writeFile(path: string, content: string): Promise<void> {
    const exists = fs.existsSync(path)
    const operation: Operation = {
      type: 'file-write',
      action: exists ? 'modify' : 'create',
      target: path,
      riskLevel: exists ? RiskLevel.MEDIUM : RiskLevel.LOW,
      description: exists
        ? `Modify existing file: ${path}`
        : `Create new file: ${path}`
    }

    const decision = await this.permissionManager.requestPermission({
      id: `write-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: `${exists ? 'Modifying' : 'Creating'} file`,
      timestamp: Date.now()
    })

    if (!decision.granted) {
      throw new PermissionDeniedError(`Permission denied to write: ${path}`)
    }

    await fs.writeFile(path, content)
  }

  async deleteFile(path: string): Promise<void> {
    const operation: Operation = {
      type: 'file-delete',
      action: 'delete',
      target: path,
      riskLevel: this.isCriticalFile(path)
        ? RiskLevel.CRITICAL
        : RiskLevel.HIGH,
      description: `Delete file: ${path}`
    }

    const decision = await this.permissionManager.requestPermission({
      id: `delete-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: `Deleting file`,
      timestamp: Date.now()
    })

    if (!decision.granted) {
      throw new PermissionDeniedError(`Permission denied to delete: ${path}`)
    }

    await fs.unlink(path)
  }

  private isSecureFile(path: string): boolean {
    // Files that are safe to read without prompting
    return /\.(md|txt|json|ya?ml)$/.test(path) &&
           !path.includes('credentials') &&
           !path.includes('secret')
  }

  private isCriticalFile(path: string): boolean {
    const critical = [
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      '.env',
      '.git'
    ]
    return critical.some(c => path.includes(c))
  }
}
```

## Audit Logging

```typescript
interface AuditLog {
  timestamp: number
  action: AuditAction
  operation: Operation
  agent: string
  decision: PermissionDecision
  reason?: string
  result?: 'success' | 'failure'
  error?: string
}

type AuditAction =
  | 'permission-granted'
  | 'permission-denied'
  | 'permission-revoked'
  | 'operation-executed'
  | 'operation-failed'

class AuditLogger {
  private logs: AuditLog[] = []
  private logFile = '.duker/audit.log'

  log(entry: Omit<AuditLog, 'timestamp'>): void {
    const log: AuditLog = {
      ...entry,
      timestamp: Date.now()
    }

    this.logs.push(log)
    this.persist(log)

    // Also log to console in debug mode
    if (process.env.DEBUG) {
      console.log('[AUDIT]', JSON.stringify(log, null, 2))
    }
  }

  private persist(log: AuditLog): void {
    const line = JSON.stringify(log) + '\n'
    fs.appendFileSync(this.logFile, line)
  }

  query(filter: AuditFilter): AuditLog[] {
    return this.logs.filter(log => {
      if (filter.agent && log.agent !== filter.agent) return false
      if (filter.action && log.action !== filter.action) return false
      if (filter.since && log.timestamp < filter.since) return false
      if (filter.until && log.timestamp > filter.until) return false
      return true
    })
  }

  getStats(): AuditStats {
    return {
      totalRequests: this.logs.length,
      granted: this.logs.filter(l => l.action === 'permission-granted').length,
      denied: this.logs.filter(l => l.action === 'permission-denied').length,
      byAgent: this.groupBy(this.logs, 'agent'),
      byRiskLevel: this.groupByRiskLevel(this.logs)
    }
  }

  private groupBy(logs: AuditLog[], key: string): Map<string, number> {
    const groups = new Map<string, number>()
    logs.forEach(log => {
      const value = (log as any)[key]
      groups.set(value, (groups.get(value) || 0) + 1)
    })
    return groups
  }

  private groupByRiskLevel(logs: AuditLog[]): Map<RiskLevel, number> {
    const groups = new Map<RiskLevel, number>()
    logs.forEach(log => {
      const level = log.operation.riskLevel
      groups.set(level, (groups.get(level) || 0) + 1)
    })
    return groups
  }
}
```

## Configuration

```typescript
// config/security.config.ts
export const securityConfig = {
  // Default permission scopes by risk level
  defaultScopes: {
    [RiskLevel.SAFE]: 'always',
    [RiskLevel.LOW]: 'session',
    [RiskLevel.MEDIUM]: 'once',
    [RiskLevel.HIGH]: 'once',
    [RiskLevel.CRITICAL]: 'once'
  },

  // Auto-deny patterns
  blacklist: [
    /rm\s+-rf\s+\//,      // Recursive delete from root
    /sudo\s+rm/,          // Sudo delete
    /dd\s+if=/,           // Disk operations
    /mkfs/,               // Format filesystem
    /:\(\)\{:\|:\&\};:/   // Fork bomb
  ],

  // Auto-allow patterns (for SAFE operations)
  whitelist: {
    'file-read': [
      'src/**/*.{ts,js,vue}',
      'docs/**/*.md',
      'package.json',
      'tsconfig.json'
    ],
    'shell': [
      'git status',
      'git diff',
      'npm test'
    ]
  },

  // Audit settings
  audit: {
    enabled: true,
    logFile: '.duker/audit.log',
    maxLogs: 10000,
    debugMode: process.env.DEBUG === 'true'
  },

  // UI settings
  ui: {
    showRiskLevel: true,
    requireConfirmationForCritical: true,
    timeout: 60000  // 60 seconds to respond
  }
}
```

## Best Practices

1. **Always Request Permission**: Never execute operations without checking
2. **Accurate Risk Assessment**: Properly classify operation risk levels
3. **Clear Communication**: Show users exactly what will happen
4. **Audit Everything**: Log all permission requests and decisions
5. **Respect User Choice**: Honor "never" decisions
6. **Secure Storage**: Protect permission configuration files
7. **Session Management**: Clear session permissions on exit
8. **Fail Secure**: Deny by default if unsure

## Integration Example

```typescript
// Complete flow with security
async function executeAgentTask(task: string) {
  const permissionManager = new PermissionManager()
  const auditLogger = new AuditLogger()

  // Create secure tools
  const tools = {
    shell: new SecureShellTool(permissionManager, 'planning-agent'),
    context: new SecureContextTool(permissionManager, 'planning-agent'),
    webSearch: new SecureWebSearchTool(permissionManager, 'planning-agent')
  }

  // Execute with security checks
  try {
    const result = await agent.execute(task, tools)

    auditLogger.log({
      action: 'operation-executed',
      operation: result.operation,
      agent: 'planning-agent',
      decision: { granted: true, scope: 'once' },
      result: 'success'
    })

    return result
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      console.log('Operation cancelled by user')
    } else {
      auditLogger.log({
        action: 'operation-failed',
        operation: error.operation,
        agent: 'planning-agent',
        decision: { granted: true, scope: 'once' },
        result: 'failure',
        error: error.message
      })
    }
    throw error
  }
}
```
