/**
 * Permission Store Module
 * Stores and retrieves permission decisions
 */

import fs from 'fs/promises'
import path from 'path'
import { Operation, PermissionDecision, StoredPermission } from '../types/index.js'

export class PermissionStore {
  private permissions: Map<string, StoredPermission> = new Map()
  private blacklist: Set<string> = new Set()
  private configPath: string
  private loaded = false

  constructor(configPath = '.duker/permissions.json') {
    this.configPath = configPath
  }

  /**
   * Initialize and load permissions from disk
   */
  async initialize(): Promise<void> {
    if (this.loaded) return

    try {
      await this.load()
      this.loaded = true
    } catch (error) {
      // File doesn't exist yet, that's ok
      this.loaded = true
    }
  }

  /**
   * Save a permission decision
   */
  async savePermission(operation: Operation, decision: PermissionDecision): Promise<void> {
    await this.initialize()

    const key = this.createKey(operation)

    if (decision.scope === 'never') {
      this.blacklist.add(key)
    } else if (decision.scope !== 'once') {
      // Save session and always permissions
      this.permissions.set(key, {
        operation,
        decision,
        createdAt: Date.now(),
        usageCount: 0,
        lastUsed: Date.now(),
      })
    }

    await this.persist()
  }

  /**
   * Find existing permission for an operation
   */
  async findPermission(operation: Operation): Promise<PermissionDecision | null> {
    await this.initialize()

    const key = this.createKey(operation)

    // Check blacklist first
    if (this.blacklist.has(key)) {
      return {
        granted: false,
        scope: 'never',
      }
    }

    const stored = this.permissions.get(key)
    if (!stored) return null

    // Check if expired
    if (stored.decision.expiresAt && Date.now() > stored.decision.expiresAt) {
      this.permissions.delete(key)
      await this.persist()
      return null
    }

    // Update usage stats
    stored.usageCount++
    stored.lastUsed = Date.now()
    await this.persist()

    return stored.decision
  }

  /**
   * Delete a permission
   */
  async deletePermission(operation: Operation): Promise<void> {
    await this.initialize()

    const key = this.createKey(operation)
    this.permissions.delete(key)
    this.blacklist.delete(key)

    await this.persist()
  }

  /**
   * Check if operation is blacklisted
   */
  async isBlacklisted(operation: Operation): Promise<boolean> {
    await this.initialize()

    const key = this.createKey(operation)
    return this.blacklist.has(key)
  }

  /**
   * Clear all permissions
   */
  async clearAll(): Promise<void> {
    this.permissions.clear()
    this.blacklist.clear()
    await this.persist()
  }

  /**
   * Get all stored permissions
   */
  async getAllPermissions(): Promise<StoredPermission[]> {
    await this.initialize()
    return Array.from(this.permissions.values())
  }

  /**
   * Create unique key for operation
   */
  private createKey(operation: Operation): string {
    return `${operation.type}:${operation.action}:${operation.target}`
  }

  /**
   * Load permissions from disk
   */
  private async load(): Promise<void> {
    const configDir = path.dirname(this.configPath)

    try {
      await fs.access(this.configPath)
    } catch {
      // File doesn't exist, create directory
      await fs.mkdir(configDir, { recursive: true })
      return
    }

    const data = await fs.readFile(this.configPath, 'utf-8')
    const parsed = JSON.parse(data)

    // Restore permissions
    if (parsed.permissions) {
      this.permissions = new Map(
        Object.entries(parsed.permissions).map(([key, value]: [string, any]) => [
          key,
          value as StoredPermission,
        ])
      )
    }

    // Restore blacklist
    if (parsed.blacklist) {
      this.blacklist = new Set(parsed.blacklist)
    }
  }

  /**
   * Persist permissions to disk
   */
  private async persist(): Promise<void> {
    const configDir = path.dirname(this.configPath)

    await fs.mkdir(configDir, { recursive: true })

    const data = {
      permissions: Object.fromEntries(this.permissions),
      blacklist: Array.from(this.blacklist),
      version: '1.0',
      lastModified: new Date().toISOString(),
    }

    await fs.writeFile(this.configPath, JSON.stringify(data, null, 2))
  }
}
