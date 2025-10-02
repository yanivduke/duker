/**
 * Iteration Manager - Smart iteration tracking with loop prevention
 * Monitors agent cycles, tracks progress, and prevents endless loops
 */

export interface IterationConfig {
  maxIterations: number
  maxDuration: number // milliseconds
  minProgress: number // 0-1, minimum progress per iteration
  stallThreshold: number // iterations without progress before stopping
  tokenBudget?: number
}

export interface IterationStep {
  id: string
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  startTime?: number
  endTime?: number
  duration?: number
  progress: number // 0-1
  metadata?: Record<string, any>
  error?: string
}

export interface IterationCycle {
  cycle: number
  startTime: number
  endTime?: number
  steps: IterationStep[]
  overallProgress: number // 0-1
  tokensUsed: number
  outcome: 'success' | 'failure' | 'stalled' | 'in_progress'
  stopReason?: string
}

export interface IterationState {
  currentCycle: number
  totalCycles: number
  cycles: IterationCycle[]
  overallProgress: number
  startTime: number
  tokensUsed: number
  isStalled: boolean
  shouldStop: boolean
  stopReason?: string
}

export class IterationManager {
  private config: IterationConfig
  private state: IterationState
  private progressHistory: number[] = []
  private onProgressCallback?: (state: IterationState) => void

  constructor(config: Partial<IterationConfig> = {}) {
    this.config = {
      maxIterations: config.maxIterations ?? 10,
      maxDuration: config.maxDuration ?? 300000, // 5 minutes
      minProgress: config.minProgress ?? 0.05, // 5% minimum
      stallThreshold: config.stallThreshold ?? 3,
      tokenBudget: config.tokenBudget,
    }

    this.state = {
      currentCycle: 0,
      totalCycles: 0,
      cycles: [],
      overallProgress: 0,
      startTime: Date.now(),
      tokensUsed: 0,
      isStalled: false,
      shouldStop: false,
    }
  }

  /**
   * Start a new iteration cycle
   */
  startCycle(): IterationCycle {
    this.state.currentCycle++
    this.state.totalCycles++

    const cycle: IterationCycle = {
      cycle: this.state.currentCycle,
      startTime: Date.now(),
      steps: [],
      overallProgress: 0,
      tokensUsed: 0,
      outcome: 'in_progress',
    }

    this.state.cycles.push(cycle)
    this.notifyProgress()

    return cycle
  }

  /**
   * Add a step to current cycle
   */
  addStep(name: string, metadata?: Record<string, any>): IterationStep {
    const currentCycle = this.getCurrentCycle()
    if (!currentCycle) {
      throw new Error('No active cycle. Call startCycle() first.')
    }

    const step: IterationStep = {
      id: `step-${currentCycle.cycle}-${currentCycle.steps.length}`,
      name,
      status: 'pending',
      progress: 0,
      metadata,
    }

    currentCycle.steps.push(step)
    this.notifyProgress()

    return step
  }

  /**
   * Update step status
   */
  updateStep(
    stepId: string,
    update: {
      status?: IterationStep['status']
      progress?: number
      metadata?: Record<string, any>
      error?: string
    }
  ): void {
    const currentCycle = this.getCurrentCycle()
    if (!currentCycle) return

    const step = currentCycle.steps.find((s) => s.id === stepId)
    if (!step) return

    if (update.status) {
      step.status = update.status

      if (update.status === 'in_progress' && !step.startTime) {
        step.startTime = Date.now()
      }

      if (
        (update.status === 'completed' || update.status === 'failed' || update.status === 'skipped') &&
        !step.endTime
      ) {
        step.endTime = Date.now()
        step.duration = step.startTime ? step.endTime - step.startTime : 0
      }
    }

    if (update.progress !== undefined) {
      step.progress = Math.min(1, Math.max(0, update.progress))
    }

    if (update.metadata) {
      step.metadata = { ...step.metadata, ...update.metadata }
    }

    if (update.error) {
      step.error = update.error
    }

    // Recalculate cycle progress
    this.updateCycleProgress()
    this.notifyProgress()
  }

  /**
   * Complete current cycle
   */
  completeCycle(tokensUsed: number = 0): void {
    const currentCycle = this.getCurrentCycle()
    if (!currentCycle) return

    currentCycle.endTime = Date.now()
    currentCycle.tokensUsed = tokensUsed
    this.state.tokensUsed += tokensUsed

    // Determine outcome
    const hasFailures = currentCycle.steps.some((s) => s.status === 'failed')
    const allCompleted = currentCycle.steps.every(
      (s) => s.status === 'completed' || s.status === 'skipped'
    )

    if (hasFailures) {
      currentCycle.outcome = 'failure'
    } else if (allCompleted) {
      currentCycle.outcome = 'success'
    } else {
      currentCycle.outcome = 'stalled'
    }

    // Update overall progress
    this.progressHistory.push(currentCycle.overallProgress)
    this.state.overallProgress = currentCycle.overallProgress

    // Check stopping conditions
    this.checkStoppingConditions()
    this.notifyProgress()
  }

  /**
   * Check if should stop iterating
   */
  shouldStopIteration(): boolean {
    return this.state.shouldStop
  }

  /**
   * Get stop reason
   */
  getStopReason(): string | undefined {
    return this.state.stopReason
  }

  /**
   * Check various stopping conditions
   */
  private checkStoppingConditions(): void {
    // 1. Max iterations reached
    if (this.state.currentCycle >= this.config.maxIterations) {
      this.state.shouldStop = true
      this.state.stopReason = `Maximum iterations reached (${this.config.maxIterations})`
      return
    }

    // 2. Max duration exceeded
    const elapsed = Date.now() - this.state.startTime
    if (elapsed >= this.config.maxDuration) {
      this.state.shouldStop = true
      this.state.stopReason = `Maximum duration exceeded (${elapsed}ms)`
      return
    }

    // 3. Token budget exceeded
    if (this.config.tokenBudget && this.state.tokensUsed >= this.config.tokenBudget) {
      this.state.shouldStop = true
      this.state.stopReason = `Token budget exceeded (${this.state.tokensUsed}/${this.config.tokenBudget})`
      return
    }

    // 4. Progress stalled
    if (this.isProgressStalled()) {
      this.state.shouldStop = true
      this.state.isStalled = true
      this.state.stopReason = `Progress stalled (no improvement in ${this.config.stallThreshold} cycles)`
      return
    }

    // 5. Task completed
    if (this.state.overallProgress >= 0.99) {
      this.state.shouldStop = true
      this.state.stopReason = 'Task completed (100% progress)'
      return
    }

    // 6. Multiple consecutive failures
    const recentCycles = this.state.cycles.slice(-3)
    const allFailed = recentCycles.length >= 3 && recentCycles.every((c) => c.outcome === 'failure')
    if (allFailed) {
      this.state.shouldStop = true
      this.state.stopReason = 'Multiple consecutive failures (3 in a row)'
      return
    }
  }

  /**
   * Check if progress has stalled
   */
  private isProgressStalled(): boolean {
    if (this.progressHistory.length < this.config.stallThreshold) {
      return false
    }

    const recent = this.progressHistory.slice(-this.config.stallThreshold)
    const maxImprovement = Math.max(
      ...recent.map((p, i) => (i === 0 ? 0 : p - recent[i - 1]))
    )

    return maxImprovement < this.config.minProgress
  }

  /**
   * Update cycle progress based on steps
   */
  private updateCycleProgress(): void {
    const currentCycle = this.getCurrentCycle()
    if (!currentCycle || currentCycle.steps.length === 0) return

    const totalProgress = currentCycle.steps.reduce((sum, step) => sum + step.progress, 0)
    currentCycle.overallProgress = totalProgress / currentCycle.steps.length
  }

  /**
   * Get current cycle
   */
  private getCurrentCycle(): IterationCycle | undefined {
    return this.state.cycles[this.state.cycles.length - 1]
  }

  /**
   * Get current state
   */
  getState(): IterationState {
    return { ...this.state }
  }

  /**
   * Get progress summary
   */
  getProgressSummary(): {
    currentCycle: number
    totalCycles: number
    overallProgress: number
    tokensUsed: number
    elapsed: number
    shouldStop: boolean
    stopReason?: string
  } {
    return {
      currentCycle: this.state.currentCycle,
      totalCycles: this.state.totalCycles,
      overallProgress: this.state.overallProgress,
      tokensUsed: this.state.tokensUsed,
      elapsed: Date.now() - this.state.startTime,
      shouldStop: this.state.shouldStop,
      stopReason: this.state.stopReason,
    }
  }

  /**
   * Register progress callback
   */
  onProgress(callback: (state: IterationState) => void): void {
    this.onProgressCallback = callback
  }

  /**
   * Notify progress change
   */
  private notifyProgress(): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(this.getState())
    }
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.state = {
      currentCycle: 0,
      totalCycles: 0,
      cycles: [],
      overallProgress: 0,
      startTime: Date.now(),
      tokensUsed: 0,
      isStalled: false,
      shouldStop: false,
    }
    this.progressHistory = []
  }

  /**
   * Get detailed report
   */
  getDetailedReport(): string {
    const lines: string[] = []
    lines.push('=== Iteration Report ===')
    lines.push(`Total Cycles: ${this.state.totalCycles}`)
    lines.push(`Overall Progress: ${(this.state.overallProgress * 100).toFixed(1)}%`)
    lines.push(`Tokens Used: ${this.state.tokensUsed}`)
    lines.push(`Elapsed: ${((Date.now() - this.state.startTime) / 1000).toFixed(1)}s`)
    lines.push(`Status: ${this.state.shouldStop ? 'STOPPED' : 'RUNNING'}`)

    if (this.state.stopReason) {
      lines.push(`Stop Reason: ${this.state.stopReason}`)
    }

    lines.push('\n=== Cycles ===')
    for (const cycle of this.state.cycles) {
      lines.push(`\nCycle ${cycle.cycle}: ${cycle.outcome.toUpperCase()}`)
      lines.push(`  Progress: ${(cycle.overallProgress * 100).toFixed(1)}%`)
      lines.push(`  Tokens: ${cycle.tokensUsed}`)
      if (cycle.endTime) {
        lines.push(`  Duration: ${((cycle.endTime - cycle.startTime) / 1000).toFixed(1)}s`)
      }

      lines.push('  Steps:')
      for (const step of cycle.steps) {
        const status = step.status.toUpperCase().padEnd(12)
        const progress = `${(step.progress * 100).toFixed(0)}%`.padEnd(5)
        lines.push(`    [${status}] ${progress} ${step.name}`)
        if (step.error) {
          lines.push(`      Error: ${step.error}`)
        }
      }
    }

    return lines.join('\n')
  }
}
