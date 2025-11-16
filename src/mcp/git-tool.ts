/**
 * Git Operations MCP Tool
 * Provides git operations for code understanding and project management
 */

import { MCPTool, ToolSchema, ToolResult } from '../types/index.js'
import simpleGit, { SimpleGit, StatusResult, DiffResult, LogResult } from 'simple-git'

export interface GitParams {
  operation:
    | 'status'
    | 'diff'
    | 'log'
    | 'branches'
    | 'current-branch'
    | 'changed-files'
    | 'file-history'
    | 'blame'
  path?: string
  branch?: string
  limit?: number
  since?: string
}

export interface GitStatus {
  current: string
  tracking?: string
  ahead: number
  behind: number
  modified: string[]
  created: string[]
  deleted: string[]
  renamed: string[]
  conflicted: string[]
  staged: string[]
  isClean: boolean
}

export interface GitCommit {
  hash: string
  author: string
  date: string
  message: string
  files: string[]
}

export interface GitBranch {
  name: string
  current: boolean
  commit: string
  label?: string
}

export interface GitBlame {
  file: string
  lines: GitBlameLine[]
}

export interface GitBlameLine {
  lineNumber: number
  content: string
  hash: string
  author: string
  date: string
}

export class GitTool implements MCPTool {
  name = 'git'
  description = 'Perform git operations for code understanding and project management'

  schema: ToolSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description:
          'Git operation: status, diff, log, branches, current-branch, changed-files, file-history, blame',
      },
      path: {
        type: 'string',
        description: 'Optional path for file-specific operations',
        optional: true,
      },
      branch: {
        type: 'string',
        description: 'Branch name for branch-specific operations',
        optional: true,
      },
      limit: {
        type: 'number',
        description: 'Limit number of results (for log, history)',
        optional: true,
      },
      since: {
        type: 'string',
        description: 'Date filter for log (e.g., "1 week ago")',
        optional: true,
      },
    },
    required: ['operation'],
  }

  private git: SimpleGit

  constructor(baseDir: string = process.cwd()) {
    this.git = simpleGit(baseDir)
  }

  async execute(params: GitParams): Promise<ToolResult> {
    try {
      const { operation } = params

      let result: any

      switch (operation) {
        case 'status':
          result = await this.getStatus()
          break
        case 'diff':
          result = await this.getDiff(params.path)
          break
        case 'log':
          result = await this.getLog(params.limit, params.since)
          break
        case 'branches':
          result = await this.getBranches()
          break
        case 'current-branch':
          result = await this.getCurrentBranch()
          break
        case 'changed-files':
          result = await this.getChangedFiles(params.branch)
          break
        case 'file-history':
          result = await this.getFileHistory(params.path!, params.limit)
          break
        case 'blame':
          result = await this.getBlame(params.path!)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      return {
        success: true,
        data: result,
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message,
      }
    }
  }

  private async getStatus(): Promise<GitStatus> {
    const status: StatusResult = await this.git.status()

    return {
      current: status.current || '',
      tracking: status.tracking || undefined,
      ahead: status.ahead,
      behind: status.behind,
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      renamed: status.renamed.map((r) => `${r.from} -> ${r.to}`),
      conflicted: status.conflicted,
      staged: status.staged,
      isClean: status.isClean(),
    }
  }

  private async getDiff(path?: string): Promise<string> {
    if (path) {
      return await this.git.diff(['HEAD', '--', path])
    }
    return await this.git.diff(['HEAD'])
  }

  private async getLog(limit: number = 10, since?: string): Promise<GitCommit[]> {
    const options: any = {
      maxCount: limit,
      format: {
        hash: '%H',
        author: '%an',
        date: '%ai',
        message: '%s',
      },
    }

    if (since) {
      options.since = since
    }

    const log: LogResult = await this.git.log(options)

    return Promise.all(
      log.all.map(async (commit) => ({
        hash: commit.hash,
        author: commit.author_name || '',
        date: commit.date,
        message: commit.message,
        files: await this.getCommitFiles(commit.hash),
      }))
    )
  }

  private async getCommitFiles(hash: string): Promise<string[]> {
    try {
      const diff = await this.git.show([hash, '--name-only', '--format='])
      return diff.split('\n').filter((f) => f.trim() !== '')
    } catch {
      return []
    }
  }

  private async getBranches(): Promise<GitBranch[]> {
    const branchSummary = await this.git.branch()

    return Object.keys(branchSummary.branches).map((name) => {
      const branch = branchSummary.branches[name]
      return {
        name,
        current: name === branchSummary.current,
        commit: branch.commit,
        label: branch.label,
      }
    })
  }

  private async getCurrentBranch(): Promise<string> {
    const branchSummary = await this.git.branch()
    return branchSummary.current
  }

  private async getChangedFiles(branch: string = 'main'): Promise<string[]> {
    try {
      const diff = await this.git.diff([`${branch}...HEAD`, '--name-only'])
      return diff.split('\n').filter((f) => f.trim() !== '')
    } catch {
      return []
    }
  }

  private async getFileHistory(
    path: string,
    limit: number = 10
  ): Promise<GitCommit[]> {
    const log: any = await this.git.log({
      file: path,
      maxCount: limit,
      format: {
        hash: '%H',
        author: '%an',
        date: '%ai',
        message: '%s',
      },
    })

    return log.all.map((commit: any) => ({
      hash: commit.hash,
      author: commit.author_name || '',
      date: commit.date,
      message: commit.message,
      files: [path],
    }))
  }

  private async getBlame(path: string): Promise<GitBlame> {
    try {
      const blameResult = await this.git.raw(['blame', '--line-porcelain', path])
      const lines = blameResult.split('\n')

      const blameLines: GitBlameLine[] = []
      let currentHash = ''
      let currentAuthor = ''
      let currentDate = ''
      let lineNumber = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        if (line.match(/^[0-9a-f]{40}/)) {
          // New commit hash
          currentHash = line.split(' ')[0]
          lineNumber = parseInt(line.split(' ')[2])
        } else if (line.startsWith('author ')) {
          currentAuthor = line.substring(7)
        } else if (line.startsWith('author-time ')) {
          const timestamp = parseInt(line.substring(12))
          currentDate = new Date(timestamp * 1000).toISOString()
        } else if (line.startsWith('\t')) {
          // Actual line content
          blameLines.push({
            lineNumber,
            content: line.substring(1),
            hash: currentHash,
            author: currentAuthor,
            date: currentDate,
          })
        }
      }

      return {
        file: path,
        lines: blameLines,
      }
    } catch (error: any) {
      throw new Error(`Failed to get blame for ${path}: ${error.message}`)
    }
  }

  /**
   * Check if current directory is a git repository
   */
  async isRepository(): Promise<boolean> {
    try {
      await this.git.status()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get repository root directory
   */
  async getRoot(): Promise<string> {
    try {
      const root = await this.git.revparse(['--show-toplevel'])
      return root.trim()
    } catch (error: any) {
      throw new Error(`Not a git repository: ${error.message}`)
    }
  }

  /**
   * Get recent changes summary
   */
  async getRecentChangesSummary(days: number = 7): Promise<{
    commits: number
    authors: string[]
    filesChanged: number
    additions: number
    deletions: number
  }> {
    const since = `${days} days ago`
    const log = await this.getLog(1000, since)

    const authors = new Set<string>()
    const files = new Set<string>()

    log.forEach((commit) => {
      authors.add(commit.author)
      commit.files.forEach((f) => files.add(f))
    })

    // Get stats
    const stats = await this.git.raw([
      'diff',
      '--shortstat',
      `HEAD~${log.length}`,
      'HEAD',
    ])

    const additionsMatch = stats.match(/(\d+) insertions?/)
    const deletionsMatch = stats.match(/(\d+) deletions?/)

    return {
      commits: log.length,
      authors: Array.from(authors),
      filesChanged: files.size,
      additions: additionsMatch ? parseInt(additionsMatch[1]) : 0,
      deletions: deletionsMatch ? parseInt(deletionsMatch[1]) : 0,
    }
  }
}
