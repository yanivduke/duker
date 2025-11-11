/**
 * Memory Tool - MCP Tool for persistent memory and context management
 * Provides agents with ability to store and retrieve information across sessions
 */

import { MCPTool, ToolSchema, ToolResult, RiskLevel } from '../types/index.js'
import { PermissionManager } from '../security/index.js'
import { StateManager, ConversationTurn } from '../core/state-manager.js'

export interface MemoryParams {
  action: 'store' | 'retrieve' | 'search' | 'list' | 'clear'
  key?: string
  value?: string
  query?: string
  category?: string
}

export class MemoryTool implements MCPTool {
  name = 'memory'
  description = 'Store and retrieve information across sessions for context continuity'

  schema: ToolSchema = {
    parameters: {
      action: {
        type: 'string',
        description: 'Action to perform: store, retrieve, search, list, or clear',
      },
      key: {
        type: 'string',
        description: 'Key for storing/retrieving specific information',
        optional: true,
      },
      value: {
        type: 'string',
        description: 'Value to store (required for store action)',
        optional: true,
      },
      query: {
        type: 'string',
        description: 'Search query (required for search action)',
        optional: true,
      },
      category: {
        type: 'string',
        description: 'Category for organizing memories (e.g., "facts", "decisions", "preferences")',
        optional: true,
      },
    },
    required: ['action'],
  }

  private permissionManager: PermissionManager
  private agent: string
  private stateManager?: StateManager
  private memoryStore: Map<string, MemoryEntry> = new Map()
  private persistencePath: string = '.duker/memory.json'

  constructor(permissionManager: PermissionManager, agent: string, stateManager?: StateManager) {
    this.permissionManager = permissionManager
    this.agent = agent
    this.stateManager = stateManager
    this.loadMemory()
  }

  async execute(params: MemoryParams): Promise<ToolResult> {
    try {
      switch (params.action) {
        case 'store':
          return await this.store(params)
        case 'retrieve':
          return await this.retrieve(params)
        case 'search':
          return await this.search(params)
        case 'list':
          return await this.list(params)
        case 'clear':
          return await this.clear(params)
        default:
          return {
            success: false,
            data: null,
            error: `Unknown action: ${params.action}`,
          }
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message,
      }
    }
  }

  /**
   * Store information in memory
   */
  private async store(params: MemoryParams): Promise<ToolResult> {
    if (!params.key || !params.value) {
      return {
        success: false,
        data: null,
        error: 'Both key and value are required for store action',
      }
    }

    // Request permission for memory write
    const permitted = await this.permissionManager.requestPermission({
      id: `memory-store-${Date.now()}`,
      operation: {
        type: 'file-write',
        action: 'store_memory',
        target: params.key,
        riskLevel: RiskLevel.LOW,
        description: `Store memory: ${params.key}`,
        metadata: { category: params.category },
      },
      agent: this.agent,
      context: 'Memory tool store operation',
      timestamp: Date.now(),
    })

    if (!permitted.granted) {
      return {
        success: false,
        data: null,
        error: 'Permission denied to store memory',
      }
    }

    const entry: MemoryEntry = {
      key: params.key,
      value: params.value,
      category: params.category ?? 'general',
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
    }

    this.memoryStore.set(params.key, entry)
    await this.persistMemory()

    return {
      success: true,
      data: {
        stored: true,
        key: params.key,
        category: entry.category,
      },
      metadata: {
        timestamp: entry.timestamp,
      },
    }
  }

  /**
   * Retrieve information from memory
   */
  private async retrieve(params: MemoryParams): Promise<ToolResult> {
    if (!params.key) {
      return {
        success: false,
        data: null,
        error: 'Key is required for retrieve action',
      }
    }

    const entry = this.memoryStore.get(params.key)

    if (!entry) {
      return {
        success: false,
        data: null,
        error: `No memory found for key: ${params.key}`,
      }
    }

    // Update access stats
    entry.lastAccessed = Date.now()
    entry.accessCount++
    await this.persistMemory()

    return {
      success: true,
      data: {
        key: entry.key,
        value: entry.value,
        category: entry.category,
      },
      metadata: {
        timestamp: entry.timestamp,
        lastAccessed: entry.lastAccessed,
        accessCount: entry.accessCount,
      },
    }
  }

  /**
   * Search memories by query
   */
  private async search(params: MemoryParams): Promise<ToolResult> {
    if (!params.query) {
      return {
        success: false,
        data: null,
        error: 'Query is required for search action',
      }
    }

    const queryLower = params.query.toLowerCase()
    const results: MemoryEntry[] = []

    for (const entry of this.memoryStore.values()) {
      const keyMatch = entry.key.toLowerCase().includes(queryLower)
      const valueMatch = entry.value.toLowerCase().includes(queryLower)
      const categoryMatch = params.category
        ? entry.category === params.category
        : true

      if ((keyMatch || valueMatch) && categoryMatch) {
        results.push(entry)
      }
    }

    // Sort by relevance (access count and recency)
    results.sort((a, b) => {
      const scoreA = a.accessCount + (Date.now() - a.timestamp) / 1000000
      const scoreB = b.accessCount + (Date.now() - b.timestamp) / 1000000
      return scoreB - scoreA
    })

    return {
      success: true,
      data: {
        count: results.length,
        results: results.map((e) => ({
          key: e.key,
          value: e.value,
          category: e.category,
          relevance: e.accessCount,
        })),
      },
    }
  }

  /**
   * List all memories (optionally filtered by category)
   */
  private async list(params: MemoryParams): Promise<ToolResult> {
    let entries = Array.from(this.memoryStore.values())

    if (params.category) {
      entries = entries.filter((e) => e.category === params.category)
    }

    // Sort by most recent
    entries.sort((a, b) => b.timestamp - a.timestamp)

    return {
      success: true,
      data: {
        count: entries.length,
        memories: entries.map((e) => ({
          key: e.key,
          category: e.category,
          timestamp: e.timestamp,
          accessCount: e.accessCount,
        })),
        categories: this.getCategories(),
      },
    }
  }

  /**
   * Clear memories (optionally by category)
   */
  private async clear(params: MemoryParams): Promise<ToolResult> {
    // Request permission for clearing memory
    const permitted = await this.permissionManager.requestPermission({
      id: `memory-clear-${Date.now()}`,
      operation: {
        type: 'file-delete',
        action: 'clear_memory',
        target: params.category ?? 'all',
        riskLevel: RiskLevel.HIGH,
        description: `Clear memory: ${params.category ?? 'all categories'}`,
      },
      agent: this.agent,
      context: 'Memory tool clear operation',
      timestamp: Date.now(),
    })

    if (!permitted.granted) {
      return {
        success: false,
        data: null,
        error: 'Permission denied to clear memory',
      }
    }

    const beforeCount = this.memoryStore.size

    if (params.category) {
      // Clear specific category
      for (const [key, entry] of this.memoryStore.entries()) {
        if (entry.category === params.category) {
          this.memoryStore.delete(key)
        }
      }
    } else {
      // Clear all
      this.memoryStore.clear()
    }

    await this.persistMemory()

    return {
      success: true,
      data: {
        cleared: beforeCount - this.memoryStore.size,
        category: params.category ?? 'all',
      },
    }
  }

  /**
   * Get all categories
   */
  private getCategories(): string[] {
    const categories = new Set<string>()
    for (const entry of this.memoryStore.values()) {
      categories.add(entry.category)
    }
    return Array.from(categories)
  }

  /**
   * Persist memory to disk
   */
  private async persistMemory(): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      const dir = path.dirname(this.persistencePath)
      await fs.mkdir(dir, { recursive: true })

      const data = JSON.stringify(Array.from(this.memoryStore.entries()), null, 2)
      await fs.writeFile(this.persistencePath, data, 'utf-8')
    } catch (error) {
      console.warn('Failed to persist memory:', error)
    }
  }

  /**
   * Load memory from disk
   */
  private async loadMemory(): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const data = await fs.readFile(this.persistencePath, 'utf-8')
      const entries: [string, MemoryEntry][] = JSON.parse(data)

      this.memoryStore = new Map(entries)
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      this.memoryStore = new Map()
    }
  }

  /**
   * Set state manager for integration
   */
  setStateManager(stateManager: StateManager): void {
    this.stateManager = stateManager
  }
}

interface MemoryEntry {
  key: string
  value: string
  category: string
  timestamp: number
  lastAccessed: number
  accessCount: number
}
