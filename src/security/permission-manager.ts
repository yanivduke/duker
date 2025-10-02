/**
 * Permission Manager Module
 * Central authority for permission management
 */

import {
  Operation,
  PermissionRequest,
  PermissionDecision,
  RiskLevel,
  PermissionScope,
} from '../types/index.js'
import { PermissionStore } from './permission-store.js'
import { AuditLogger } from './audit-logger.js'
import { RiskAssessment } from './risk-assessment.js'

export class PermissionManager {
  private store: PermissionStore
  private audit: AuditLogger
  private riskAssessment: RiskAssessment
  private uiCallback?: (request: PermissionRequest) => Promise<PermissionDecision>

  constructor(
    store?: PermissionStore,
    audit?: AuditLogger,
    riskAssessment?: RiskAssessment
  ) {
    this.store = store || new PermissionStore()
    this.audit = audit || new AuditLogger()
    this.riskAssessment = riskAssessment || new RiskAssessment()
  }

  /**
   * Set UI callback for permission prompts
   */
  setUICallback(callback: (request: PermissionRequest) => Promise<PermissionDecision>): void {
    this.uiCallback = callback
  }

  /**
   * Request permission for an operation
   */
  async requestPermission(request: PermissionRequest): Promise<PermissionDecision> {
    // 1. Check existing permissions
    const existing = await this.store.findPermission(request.operation)
    if (existing) {
      await this.audit.log({
        action: 'permission-granted',
        operation: request.operation,
        agent: request.agent,
        decision: existing,
        reason: 'existing-permission',
      })
      return existing
    }

    // 2. Auto-allow SAFE operations
    if (request.operation.riskLevel === RiskLevel.SAFE) {
      const decision: PermissionDecision = {
        granted: true,
        scope: 'always',
      }

      await this.audit.log({
        action: 'permission-granted',
        operation: request.operation,
        agent: request.agent,
        decision,
        reason: 'safe-operation',
      })

      return decision
    }

    // 3. Check if blacklisted
    if (await this.store.isBlacklisted(request.operation)) {
      const decision: PermissionDecision = {
        granted: false,
        scope: 'never',
      }

      await this.audit.log({
        action: 'permission-denied',
        operation: request.operation,
        agent: request.agent,
        decision,
        reason: 'blacklisted',
      })

      return decision
    }

    // 4. Prompt user via UI
    if (!this.uiCallback) {
      throw new Error('No UI callback registered for permission prompts')
    }

    const decision = await this.uiCallback(request)

    // 5. Save decision if needed
    if (decision.scope === 'always' || decision.scope === 'never') {
      await this.store.savePermission(request.operation, decision)
    } else if (decision.scope === 'session') {
      // Set expiration for session (24 hours)
      decision.expiresAt = Date.now() + 24 * 60 * 60 * 1000
      await this.store.savePermission(request.operation, decision)
    }

    // 6. Log decision
    await this.audit.log({
      action: decision.granted ? 'permission-granted' : 'permission-denied',
      operation: request.operation,
      agent: request.agent,
      decision,
      reason: 'user-decision',
    })

    return decision
  }

  /**
   * Check if permission exists for an operation
   */
  async checkPermission(operation: Operation): Promise<boolean> {
    const permission = await this.store.findPermission(operation)
    return permission?.granted ?? false
  }

  /**
   * Revoke a permission
   */
  async revokePermission(operation: Operation): Promise<void> {
    await this.store.deletePermission(operation)
    await this.audit.log({
      action: 'permission-revoked',
      operation,
      agent: 'user',
      reason: 'manual-revoke',
    })
  }

  /**
   * Get audit statistics
   */
  getStats() {
    return this.audit.getStats()
  }

  /**
   * Create operation with risk assessment
   */
  createOperation(
    type: Operation['type'],
    action: string,
    target: string,
    description?: string
  ): Operation {
    return this.riskAssessment.createOperation(type, action, target, description)
  }
}
