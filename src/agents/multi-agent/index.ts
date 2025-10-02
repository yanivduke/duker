/**
 * Multi-Agent System Exports
 */

export { MultiAgentCoordinator } from './coordinator.js'
export { BaseSpecialistAgent } from './base-specialist.js'
export { SecurityAgent } from './specialists/security-agent.js'
export { PerformanceAgent } from './specialists/performance-agent.js'
export { TestingAgent } from './specialists/testing-agent.js'

export type {
  Specialty,
  MessageType,
  AgentMessage,
  SpecializedTask,
  SpecialistResult,
  AgentCapability,
  CollaborationPlan,
  CollaborationPhase,
} from './types.js'
