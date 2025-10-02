/**
 * Audit Logger Module
 * Logs all security-related events
 */

import fs from 'fs/promises'
import path from 'path'
import { Operation, PermissionDecision } from '../types/index.js'

export type AuditAction =
  | 'permission-granted'
  | 'permission-denied'
  | 'permission-revoked'
  | 'operation-executed'
  | 'operation-failed'

export interface AuditLog {
  timestamp: number
  action: AuditAction
  operation: Operation
  agent: string
  decision?: PermissionDecision
  reason?: string
  result?: 'success' | 'failure'
  error?: string
}

export class AuditLogger {
  private logs: AuditLog[] = []
  private logFile: string
  private maxLogs: number
  private debugMode: boolean

  constructor(
    logFile = '.duker/audit.log',
    maxLogs = 10000,
    debugMode = false
  ) {
    this.logFile = logFile
    this.maxLogs = maxLogs
    this.debugMode = debugMode
  }

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLog, 'timestamp'>): Promise<void> {
    const log: AuditLog = {
      ...entry,
      timestamp: Date.now(),
    }

    this.logs.push(log)

    // Trim if exceeds max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Persist to file
    await this.persist(log)

    // Debug output
    if (this.debugMode) {
      console.log('[AUDIT]', JSON.stringify(log, null, 2))
    }
  }

  /**
   * Query audit logs
   */
  query(filter: AuditFilter): AuditLog[] {
    return this.logs.filter((log) => {
      if (filter.agent && log.agent !== filter.agent) return false
      if (filter.action && log.action !== filter.action) return false
      if (filter.since && log.timestamp < filter.since) return false
      if (filter.until && log.timestamp > filter.until) return false
      return true
    })
  }

  /**
   * Get statistics
   */
  getStats(): AuditStats {
    const byAgent = new Map<string, number>()
    const byAction = new Map<AuditAction, number>()
    const byRiskLevel = new Map<number, number>()

    this.logs.forEach((log) => {
      // Count by agent
      byAgent.set(log.agent, (byAgent.get(log.agent) || 0) + 1)

      // Count by action
      byAction.set(log.action, (byAction.get(log.action) || 0) + 1)

      // Count by risk level
      const level = log.operation.riskLevel
      byRiskLevel.set(level, (byRiskLevel.get(level) || 0) + 1)
    })

    return {
      totalRequests: this.logs.length,
      granted: this.logs.filter((l) => l.action === 'permission-granted').length,
      denied: this.logs.filter((l) => l.action === 'permission-denied').length,
      byAgent,
      byAction,
      byRiskLevel,
    }
  }

  /**
   * Clear all logs
   */
  async clear(): Promise<void> {
    this.logs = []
    const logDir = path.dirname(this.logFile)
    await fs.mkdir(logDir, { recursive: true })
    await fs.writeFile(this.logFile, '')
  }

  /**
   * Persist single log entry to file
   */
  private async persist(log: AuditLog): Promise<void> {
    const logDir = path.dirname(this.logFile)

    try {
      await fs.mkdir(logDir, { recursive: true })
      const line = JSON.stringify(log) + '\n'
      await fs.appendFile(this.logFile, line)
    } catch (error) {
      console.error('Failed to write audit log:', error)
    }
  }
}

export interface AuditFilter {
  agent?: string
  action?: AuditAction
  since?: number
  until?: number
}

export interface AuditStats {
  totalRequests: number
  granted: number
  denied: number
  byAgent: Map<string, number>
  byAction: Map<AuditAction, number>
  byRiskLevel: Map<number, number>
}
