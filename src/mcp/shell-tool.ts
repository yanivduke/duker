/**
 * Shell Tool - Execute terminal commands with security
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import {
  MCPTool,
  ShellParams,
  ShellResult,
  ToolSchema,
  PermissionDeniedError,
} from '../types/index.js'
import { PermissionManager } from '../security/index.js'

const execAsync = promisify(exec)

export class ShellTool implements MCPTool {
  name = 'shell'
  description = 'Execute terminal commands'

  schema: ToolSchema = {
    parameters: {
      command: {
        type: 'string',
        description: 'The command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory',
        optional: true,
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        optional: true,
      },
    },
    required: ['command'],
  }

  private permissionManager: PermissionManager
  private agentId: string

  constructor(permissionManager: PermissionManager, agentId: string) {
    this.permissionManager = permissionManager
    this.agentId = agentId
  }

  async execute(params: ShellParams): Promise<ShellResult> {
    // Basic validation
    this.validateCommand(params.command)

    // Create operation for permission check
    const operation = this.permissionManager.createOperation(
      'shell',
      params.command,
      params.cwd || process.cwd(),
      `Execute shell command: ${params.command}`
    )

    // Request permission
    const decision = await this.permissionManager.requestPermission({
      id: `shell-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: 'Shell command execution requested',
      timestamp: Date.now(),
    })

    if (!decision.granted) {
      throw new PermissionDeniedError(
        `Permission denied for command: ${params.command}`
      )
    }

    // Execute command
    return await this.executeCommand(params)
  }

  private async executeCommand(params: ShellParams): Promise<ShellResult> {
    const startTime = Date.now()

    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd: params.cwd,
        env: { ...process.env, ...params.env },
        timeout: params.timeout || 30000,
        shell: params.shell || '/bin/bash',
      })

      return {
        success: true,
        data: {
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: 0,
          duration: Date.now() - startTime,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        data: {
          stdout: error.stdout?.toString() || '',
          stderr: error.stderr?.toString() || error.message,
          exitCode: error.code || 1,
          duration: Date.now() - startTime,
        },
        error: error.message,
      }
    }
  }

  private validateCommand(command: string): void {
    // Basic dangerous command detection
    const dangerous = [
      'rm -rf /',
      'dd if=',
      '> /dev/sda',
      'mkfs',
      ':(){:|:&};:',
    ]

    if (dangerous.some((d) => command.includes(d))) {
      throw new Error('Dangerous command detected')
    }
  }
}
