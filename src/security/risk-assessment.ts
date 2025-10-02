/**
 * Risk Assessment Module
 * Determines risk level for operations
 */

import { RiskLevel, Operation, OperationType } from '../types/index.js'

export class RiskAssessment {
  /**
   * Assess risk level for shell commands
   */
  assessShellCommand(command: string): RiskLevel {
    // CRITICAL: Dangerous system commands
    const criticalPatterns = [
      /rm\s+-rf\s+\//,
      /sudo\s+rm/,
      /dd\s+if=/,
      /mkfs/,
      /:\(\)\{:\|:\&\};:/,  // fork bomb
      />.*\/dev\/sd/,
      /curl.*\|.*sh/,
      /wget.*\|.*sh/,
    ]

    if (criticalPatterns.some(pattern => pattern.test(command))) {
      return RiskLevel.CRITICAL
    }

    // HIGH: Package installation, git push, system modifications
    const highPatterns = [
      /npm\s+(install|i|uninstall)\s/,
      /yarn\s+(add|remove)/,
      /pnpm\s+(add|remove)/,
      /git\s+push/,
      /docker\s+(build|run|exec)/,
      /chmod/,
      /chown/,
    ]

    if (highPatterns.some(pattern => pattern.test(command))) {
      return RiskLevel.HIGH
    }

    // MEDIUM: Git commits, test runs, builds
    const mediumPatterns = [
      /git\s+commit/,
      /git\s+merge/,
      /npm\s+(run|test|build)/,
      /yarn\s+(test|build)/,
    ]

    if (mediumPatterns.some(pattern => pattern.test(command))) {
      return RiskLevel.MEDIUM
    }

    // LOW: Read-only git, ls, cat, etc.
    const lowPatterns = [
      /^git\s+(status|log|diff|show)/,
      /^ls\s/,
      /^cat\s/,
      /^head\s/,
      /^tail\s/,
      /^grep\s/,
      /^find\s/,
    ]

    if (lowPatterns.some(pattern => pattern.test(command))) {
      return RiskLevel.LOW
    }

    // Default: MEDIUM for unknown commands
    return RiskLevel.MEDIUM
  }

  /**
   * Assess risk level for file operations
   */
  assessFileOperation(operation: 'read' | 'write' | 'delete', path: string): RiskLevel {
    // Critical files that should never be deleted
    const criticalFiles = [
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      '.git',
      '.env',
    ]

    // Sensitive files
    const sensitivePatterns = [
      /credentials/i,
      /secret/i,
      /password/i,
      /\.env/,
      /\.pem$/,
      /\.key$/,
    ]

    const isCriticalFile = criticalFiles.some(cf => path.includes(cf))
    const isSensitiveFile = sensitivePatterns.some(pattern => pattern.test(path))

    if (operation === 'delete') {
      if (isCriticalFile) return RiskLevel.CRITICAL
      if (isSensitiveFile) return RiskLevel.HIGH
      return RiskLevel.HIGH  // All deletes are HIGH by default
    }

    if (operation === 'write') {
      if (isCriticalFile) return RiskLevel.HIGH
      if (isSensitiveFile) return RiskLevel.MEDIUM
      // Check if file exists - creating is LOW, modifying is MEDIUM
      return RiskLevel.MEDIUM
    }

    // Read operations
    if (isSensitiveFile) return RiskLevel.LOW

    // Safe file patterns (source code, docs)
    const safePatterns = [
      /\.(ts|js|tsx|jsx|vue)$/,
      /\.(md|txt)$/,
      /\.json$/,
      /\.(ya?ml)$/,
    ]

    if (safePatterns.some(pattern => pattern.test(path))) {
      return RiskLevel.SAFE
    }

    return RiskLevel.LOW
  }

  /**
   * Create operation object with risk assessment
   */
  createOperation(
    type: OperationType,
    action: string,
    target: string,
    description?: string
  ): Operation {
    let riskLevel: RiskLevel

    switch (type) {
      case 'shell':
        riskLevel = this.assessShellCommand(action)
        break

      case 'file-read':
        riskLevel = this.assessFileOperation('read', target)
        break

      case 'file-write':
        riskLevel = this.assessFileOperation('write', target)
        break

      case 'file-delete':
        riskLevel = this.assessFileOperation('delete', target)
        break

      case 'network':
        riskLevel = RiskLevel.MEDIUM
        break

      case 'package':
        riskLevel = RiskLevel.HIGH
        break

      case 'env':
        riskLevel = RiskLevel.CRITICAL
        break

      default:
        riskLevel = RiskLevel.MEDIUM
    }

    return {
      type,
      action,
      target,
      riskLevel,
      description: description || `${type}: ${action} ${target}`,
    }
  }
}
