/**
 * Multi-Agent System Types
 */

export type Specialty =
  | 'coordinator'
  | 'security'
  | 'performance'
  | 'testing'
  | 'documentation'
  | 'architecture'
  | 'frontend'
  | 'backend'

export type MessageType =
  | 'request'
  | 'response'
  | 'proposal'
  | 'critique'
  | 'collaboration'
  | 'result'

export interface AgentMessage {
  from: string
  to: string
  type: MessageType
  content: any
  timestamp: number
}

export interface SpecializedTask {
  id: string
  description: string
  context?: any
  dependencies?: string[]
}

export interface SpecialistResult {
  agentId: string
  specialty: Specialty
  task: SpecializedTask
  output: string
  confidence: number
  metadata?: Record<string, any>
}

export interface AgentCapability {
  name: string
  description: string
}

export interface CollaborationPlan {
  phases: CollaborationPhase[]
  overallGoal: string
}

export interface CollaborationPhase {
  id: string
  name: string
  agents: Specialty[]
  task: string
  dependencies?: string[]
  parallel?: boolean
}
