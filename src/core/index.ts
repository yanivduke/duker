/**
 * Core - Iteration management, state management, and utilities
 */

export { IterationManager } from './iteration-manager.js'
export type {
  IterationConfig,
  IterationStep,
  IterationCycle,
  IterationState,
} from './iteration-manager.js'

export { StateManager } from './state-manager.js'
export type {
  ConversationTurn,
  CodeSnippet,
  Decision,
  WorkingMemory,
  SubTask,
  ProjectContext,
  SessionState,
} from './state-manager.js'
