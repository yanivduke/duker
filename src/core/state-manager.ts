/**
 * State Manager - Programmer State of Mind
 * Maintains context, conversation history, and working state across the session
 */

export interface ConversationTurn {
  id: string
  timestamp: number
  userMessage: string
  assistantResponse: string
  context: {
    filesReferenced: string[]
    toolsUsed: string[]
    codeSnippets: CodeSnippet[]
    decisions: Decision[]
  }
  metadata: {
    tokensUsed: number
    pattern: string
    quality?: number
    thinkingBlocks?: Array<{ content: string; type: string }>
  }
}

export interface CodeSnippet {
  id: string
  file: string
  language: string
  content: string
  lineRange?: { start: number; end: number }
  purpose: string
}

export interface Decision {
  id: string
  question: string
  answer: string
  reasoning: string
  timestamp: number
}

export interface WorkingMemory {
  currentTask: string
  subTasks: SubTask[]
  goals: string[]
  constraints: string[]
  assumptions: string[]
  openQuestions: string[]
}

export interface SubTask {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  dependencies: string[]
  blockers?: string[]
}

export interface ProjectContext {
  name: string
  path: string
  language: string[]
  frameworks: string[]
  packageManager?: string
  buildTool?: string
  testFramework?: string
  keyFiles: string[]
  codeStyle?: Record<string, any>
}

export interface SessionState {
  id: string
  startTime: number
  lastActive: number
  conversationHistory: ConversationTurn[]
  workingMemory: WorkingMemory
  projectContext: ProjectContext
  cumulativeStats: {
    totalTokens: number
    totalTurns: number
    toolsUsed: Record<string, number>
    filesModified: string[]
    thinkingTokensUsed: number
  }
}

export class StateManager {
  private state: SessionState
  private maxHistoryTurns: number
  private persistenceEnabled: boolean
  private persistencePath?: string

  constructor(config: {
    maxHistoryTurns?: number
    persistenceEnabled?: boolean
    persistencePath?: string
    projectContext?: Partial<ProjectContext>
  } = {}) {
    this.maxHistoryTurns = config.maxHistoryTurns ?? 50
    this.persistenceEnabled = config.persistenceEnabled ?? true
    this.persistencePath = config.persistencePath ?? '.duker/session-state.json'

    this.state = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      lastActive: Date.now(),
      conversationHistory: [],
      workingMemory: {
        currentTask: '',
        subTasks: [],
        goals: [],
        constraints: [],
        assumptions: [],
        openQuestions: [],
      },
      projectContext: {
        name: config.projectContext?.name ?? 'unknown',
        path: config.projectContext?.path ?? process.cwd(),
        language: config.projectContext?.language ?? [],
        frameworks: config.projectContext?.frameworks ?? [],
        keyFiles: config.projectContext?.keyFiles ?? [],
      },
      cumulativeStats: {
        totalTokens: 0,
        totalTurns: 0,
        toolsUsed: {},
        filesModified: [],
        thinkingTokensUsed: 0,
      },
    }
  }

  /**
   * Add a conversation turn
   */
  addConversationTurn(turn: Omit<ConversationTurn, 'id' | 'timestamp'>): ConversationTurn {
    const completeTurn: ConversationTurn = {
      id: this.generateTurnId(),
      timestamp: Date.now(),
      ...turn,
    }

    this.state.conversationHistory.push(completeTurn)
    this.state.lastActive = Date.now()
    this.state.cumulativeStats.totalTurns++
    this.state.cumulativeStats.totalTokens += turn.metadata.tokensUsed

    // Track tools used
    for (const tool of turn.context.toolsUsed) {
      this.state.cumulativeStats.toolsUsed[tool] =
        (this.state.cumulativeStats.toolsUsed[tool] ?? 0) + 1
    }

    // Track thinking tokens
    if (turn.metadata.thinkingBlocks) {
      this.state.cumulativeStats.thinkingTokensUsed += turn.metadata.thinkingBlocks.reduce(
        (sum, block) => sum + (block.content?.length ?? 0),
        0
      )
    }

    // Trim history if needed
    if (this.state.conversationHistory.length > this.maxHistoryTurns) {
      this.state.conversationHistory = this.state.conversationHistory.slice(-this.maxHistoryTurns)
    }

    if (this.persistenceEnabled) {
      this.persist()
    }

    return completeTurn
  }

  /**
   * Update working memory
   */
  updateWorkingMemory(updates: Partial<WorkingMemory>): void {
    this.state.workingMemory = {
      ...this.state.workingMemory,
      ...updates,
    }
    this.state.lastActive = Date.now()

    if (this.persistenceEnabled) {
      this.persist()
    }
  }

  /**
   * Add a subtask
   */
  addSubTask(task: Omit<SubTask, 'id'>): SubTask {
    const subTask: SubTask = {
      id: this.generateSubTaskId(),
      ...task,
    }

    this.state.workingMemory.subTasks.push(subTask)
    this.state.lastActive = Date.now()

    if (this.persistenceEnabled) {
      this.persist()
    }

    return subTask
  }

  /**
   * Update subtask status
   */
  updateSubTask(id: string, updates: Partial<SubTask>): void {
    const task = this.state.workingMemory.subTasks.find((t) => t.id === id)
    if (task) {
      Object.assign(task, updates)
      this.state.lastActive = Date.now()

      if (this.persistenceEnabled) {
        this.persist()
      }
    }
  }

  /**
   * Add a decision to the most recent turn
   */
  addDecision(decision: Omit<Decision, 'id' | 'timestamp'>): void {
    const latestTurn = this.getLatestTurn()
    if (latestTurn) {
      latestTurn.context.decisions.push({
        id: this.generateDecisionId(),
        timestamp: Date.now(),
        ...decision,
      })

      this.state.lastActive = Date.now()

      if (this.persistenceEnabled) {
        this.persist()
      }
    }
  }

  /**
   * Get recent context for prompting
   */
  getRecentContext(turns: number = 5): string {
    const recentTurns = this.state.conversationHistory.slice(-turns)

    let context = `# Session Context\n\n`
    context += `**Current Task**: ${this.state.workingMemory.currentTask || 'None'}\n\n`

    if (this.state.workingMemory.goals.length > 0) {
      context += `**Goals**:\n${this.state.workingMemory.goals.map((g) => `- ${g}`).join('\n')}\n\n`
    }

    if (this.state.workingMemory.constraints.length > 0) {
      context += `**Constraints**:\n${this.state.workingMemory.constraints.map((c) => `- ${c}`).join('\n')}\n\n`
    }

    if (this.state.workingMemory.openQuestions.length > 0) {
      context += `**Open Questions**:\n${this.state.workingMemory.openQuestions.map((q) => `- ${q}`).join('\n')}\n\n`
    }

    if (recentTurns.length > 0) {
      context += `## Recent Conversation\n\n`
      for (const turn of recentTurns) {
        context += `**User**: ${turn.userMessage}\n`
        context += `**Assistant**: ${turn.assistantResponse.substring(0, 500)}${turn.assistantResponse.length > 500 ? '...' : ''}\n\n`

        if (turn.context.decisions.length > 0) {
          context += `**Decisions Made**:\n`
          for (const decision of turn.context.decisions) {
            context += `- ${decision.question}: ${decision.answer}\n`
          }
          context += `\n`
        }
      }
    }

    return context
  }

  /**
   * Get project context summary
   */
  getProjectContextSummary(): string {
    const pc = this.state.projectContext
    let summary = `# Project Context\n\n`
    summary += `**Name**: ${pc.name}\n`
    summary += `**Path**: ${pc.path}\n`

    if (pc.language.length > 0) {
      summary += `**Languages**: ${pc.language.join(', ')}\n`
    }

    if (pc.frameworks.length > 0) {
      summary += `**Frameworks**: ${pc.frameworks.join(', ')}\n`
    }

    if (pc.packageManager) {
      summary += `**Package Manager**: ${pc.packageManager}\n`
    }

    if (pc.keyFiles.length > 0) {
      summary += `**Key Files**:\n${pc.keyFiles.map((f) => `- ${f}`).join('\n')}\n`
    }

    return summary
  }

  /**
   * Get session statistics
   */
  getStats(): SessionState['cumulativeStats'] {
    return { ...this.state.cumulativeStats }
  }

  /**
   * Get latest conversation turn
   */
  getLatestTurn(): ConversationTurn | undefined {
    return this.state.conversationHistory[this.state.conversationHistory.length - 1]
  }

  /**
   * Get full state
   */
  getState(): SessionState {
    return { ...this.state }
  }

  /**
   * Clear working memory (keep conversation history)
   */
  clearWorkingMemory(): void {
    this.state.workingMemory = {
      currentTask: '',
      subTasks: [],
      goals: [],
      constraints: [],
      assumptions: [],
      openQuestions: [],
    }

    if (this.persistenceEnabled) {
      this.persist()
    }
  }

  /**
   * Persist state to disk
   */
  private async persist(): Promise<void> {
    if (!this.persistencePath) return

    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      const dir = path.dirname(this.persistencePath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(this.persistencePath, JSON.stringify(this.state, null, 2), 'utf-8')
    } catch (error) {
      console.warn('Failed to persist state:', error)
    }
  }

  /**
   * Load state from disk
   */
  async load(): Promise<boolean> {
    if (!this.persistencePath) return false

    try {
      const fs = await import('fs/promises')
      const data = await fs.readFile(this.persistencePath, 'utf-8')
      const loadedState = JSON.parse(data)

      // Validate and merge state
      if (loadedState.id && loadedState.startTime) {
        this.state = loadedState
        this.state.lastActive = Date.now()
        return true
      }
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      return false
    }

    return false
  }

  /**
   * Generate unique IDs
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  private generateTurnId(): string {
    return `turn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  private generateSubTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  private generateDecisionId(): string {
    return `decision-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
}
