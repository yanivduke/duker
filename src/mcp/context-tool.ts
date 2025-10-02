/**
 * Context Tool - Codebase analysis and file operations with security
 */

import fs from 'fs/promises'
import { stat } from 'fs/promises'
import { glob } from 'glob'
import {
  MCPTool,
  FileContent,
  ToolResult,
  ToolSchema,
  PermissionDeniedError,
} from '../types/index.js'
import { PermissionManager } from '../security/index.js'

export class ContextTool implements MCPTool {
  name = 'context'
  description = 'Codebase analysis and file operations'

  schema: ToolSchema = {
    parameters: {
      operation: {
        type: 'string',
        description: 'Operation: read, write, find',
      },
      path: {
        type: 'string',
        description: 'File path or pattern',
      },
      content: {
        type: 'string',
        description: 'Content for write operations',
        optional: true,
      },
    },
    required: ['operation', 'path'],
  }

  private permissionManager: PermissionManager
  private agentId: string

  private languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.js': 'javascript',
    '.tsx': 'typescript-react',
    '.jsx': 'javascript-react',
    '.vue': 'vue',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.md': 'markdown',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
  }

  constructor(permissionManager: PermissionManager, agentId: string) {
    this.permissionManager = permissionManager
    this.agentId = agentId
  }

  async execute(params: any): Promise<ToolResult> {
    const { operation, path, content } = params

    switch (operation) {
      case 'read':
        return await this.readFile(path)
      case 'write':
        return await this.writeFile(path, content)
      case 'find':
        return await this.findFiles(path)
      default:
        return {
          success: false,
          data: null,
          error: `Unknown operation: ${operation}`,
        }
    }
  }

  private async readFile(path: string): Promise<ToolResult> {
    // Create operation for permission check
    const operation = this.permissionManager.createOperation(
      'file-read',
      'read',
      path,
      `Read file: ${path}`
    )

    // Request permission
    const decision = await this.permissionManager.requestPermission({
      id: `read-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: 'Reading file for analysis',
      timestamp: Date.now(),
    })

    if (!decision.granted) {
      throw new PermissionDeniedError(`Permission denied to read: ${path}`)
    }

    try {
      const content = await fs.readFile(path, 'utf-8')
      const stats = await stat(path)
      const ext = path.substring(path.lastIndexOf('.'))

      const fileContent: FileContent = {
        path,
        content,
        language: this.languageMap[ext] || 'unknown',
        size: stats.size,
        lastModified: stats.mtime,
      }

      return {
        success: true,
        data: fileContent,
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message,
      }
    }
  }

  private async writeFile(path: string, content: string): Promise<ToolResult> {
    // Check if file exists
    let exists = false
    try {
      await fs.access(path)
      exists = true
    } catch {
      exists = false
    }

    // Create operation for permission check
    const operation = this.permissionManager.createOperation(
      'file-write',
      exists ? 'modify' : 'create',
      path,
      exists ? `Modify file: ${path}` : `Create file: ${path}`
    )

    // Request permission
    const decision = await this.permissionManager.requestPermission({
      id: `write-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: exists ? 'Modifying existing file' : 'Creating new file',
      timestamp: Date.now(),
    })

    if (!decision.granted) {
      throw new PermissionDeniedError(`Permission denied to write: ${path}`)
    }

    try {
      await fs.writeFile(path, content, 'utf-8')

      return {
        success: true,
        data: {
          path,
          size: content.length,
          operation: exists ? 'modified' : 'created',
        },
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message,
      }
    }
  }

  private async findFiles(pattern: string): Promise<ToolResult> {
    try {
      const files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      })

      return {
        success: true,
        data: {
          pattern,
          files,
          count: files.length,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message,
      }
    }
  }
}
