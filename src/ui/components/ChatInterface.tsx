/**
 * ChatInterface - Vue3/Ink Terminal Chat UI for Duker
 * Interactive chat interface with agent visualization
 */

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import Spinner from 'ink-spinner'
import { IterationState } from '../../core/iteration-manager.js'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: {
    pattern?: string
    quality?: number
    tokens?: number
    duration?: number
  }
}

export interface ChatInterfaceProps {
  onMessage: (message: string) => Promise<void>
  messages: Message[]
  isProcessing: boolean
  iterationState?: IterationState
  currentPattern?: string
  activeAgents?: AgentActivity[]
}

export interface AgentActivity {
  id: string
  specialty: string
  status: 'active' | 'waiting' | 'completed'
  tokensUsed: number
  currentTask?: string
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onMessage,
  messages,
  isProcessing,
  iterationState,
  currentPattern,
  activeAgents,
}) => {
  const [input, setInput] = useState('')
  const { exit } = useApp()

  useInput((inputChar, key) => {
    if (key.return) {
      if (input.trim()) {
        const message = input.trim()
        setInput('')
        onMessage(message)
      }
    } else if (key.backspace || key.delete) {
      setInput(input.slice(0, -1))
    } else if (key.escape) {
      exit()
    } else if (!key.ctrl && !key.meta && inputChar) {
      setInput(input + inputChar)
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">
            🤖 Duker AI Assistant
          </Text>
          <Text dimColor>
            DukeCode Terminal Chat • Phase 3 • Press ESC to exit
          </Text>
        </Box>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1} paddingX={1}>
        {messages.slice(-10).map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
      </Box>

      {/* Iteration Progress */}
      {isProcessing && iterationState && (
        <IterationProgress state={iterationState} pattern={currentPattern} />
      )}

      {/* Active Agents - Multi-Agent Mode */}
      {isProcessing && activeAgents && activeAgents.length > 0 && (
        <ActiveAgentsPanel agents={activeAgents} />
      )}

      {/* Input */}
      <Box borderStyle="single" borderColor="green" padding={1}>
        <Text color="green">{'> '}</Text>
        <Text>{input}</Text>
        <Text color="gray">█</Text>
      </Box>

      {/* Help */}
      <Box marginTop={1}>
        <Text dimColor>
          Type your message and press Enter • ESC to exit
        </Text>
      </Box>
    </Box>
  )
}

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  const roleColor = isUser ? 'blue' : isSystem ? 'yellow' : 'green'
  const roleLabel = isUser ? 'You' : isSystem ? 'System' : 'Duker'

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={roleColor} bold>
          {roleLabel}
        </Text>
        <Text dimColor> • {new Date(message.timestamp).toLocaleTimeString()}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text>{message.content}</Text>
      </Box>
      {message.metadata && (
        <Box paddingLeft={2} marginTop={1}>
          <MetadataDisplay metadata={message.metadata} />
        </Box>
      )}
    </Box>
  )
}

const MetadataDisplay: React.FC<{ metadata: Message['metadata'] }> = ({ metadata }) => {
  if (!metadata) return null

  return (
    <Box>
      {metadata.pattern && (
        <Text dimColor>
          Pattern: <Text color="magenta">{metadata.pattern.toUpperCase()}</Text>
        </Text>
      )}
      {metadata.quality !== undefined && (
        <Text dimColor>
          {' • '}Quality: <Text color={metadata.quality >= 0.9 ? 'green' : 'yellow'}>
            {(metadata.quality * 100).toFixed(1)}%
          </Text>
        </Text>
      )}
      {metadata.tokens && (
        <Text dimColor>
          {' • '}Tokens: {metadata.tokens}
        </Text>
      )}
      {metadata.duration && (
        <Text dimColor>
          {' • '}{metadata.duration}ms
        </Text>
      )}
    </Box>
  )
}

const IterationProgress: React.FC<{
  state: IterationState
  pattern?: string
}> = ({ state, pattern }) => {
  const currentCycle = state.cycles[state.cycles.length - 1]

  return (
    <Box
      borderStyle="round"
      borderColor="yellow"
      padding={1}
      marginBottom={1}
      flexDirection="column"
    >
      <Box marginBottom={1}>
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
        <Text bold color="yellow">
          {' '}Processing with {pattern?.toUpperCase() || 'DIRECT'} pattern
        </Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2}>
        <Text>
          Cycle: <Text bold>{state.currentCycle}</Text> / {state.totalCycles}
        </Text>
        <Text>
          Progress: <ProgressBar progress={state.overallProgress} />
          {' '}<Text color="cyan">{(state.overallProgress * 100).toFixed(0)}%</Text>
        </Text>
        <Text>
          Tokens: <Text color="magenta">{state.tokensUsed}</Text>
        </Text>
      </Box>

      {currentCycle && currentCycle.steps.length > 0 && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Text dimColor>Steps:</Text>
          {currentCycle.steps.map((step, idx) => (
            <StepDisplay key={idx} step={step} />
          ))}
        </Box>
      )}
    </Box>
  )
}

const StepDisplay: React.FC<{ step: any }> = ({ step }) => {
  const statusIcons = {
    pending: '⏳',
    in_progress: '⚙️ ',
    completed: '✅',
    failed: '❌',
    skipped: '⏭️ ',
  }

  const statusColors = {
    pending: 'gray',
    in_progress: 'yellow',
    completed: 'green',
    failed: 'red',
    skipped: 'blue',
  }

  return (
    <Box paddingLeft={1}>
      <Text color={statusColors[step.status as keyof typeof statusColors]}>
        {statusIcons[step.status as keyof typeof statusIcons]}
        {' '}{step.name}
        {step.progress > 0 && step.status !== 'completed' && (
          <Text dimColor> ({(step.progress * 100).toFixed(0)}%)</Text>
        )}
      </Text>
    </Box>
  )
}

const ProgressBar: React.FC<{ progress: number; width?: number }> = ({
  progress,
  width = 20,
}) => {
  const filled = Math.round(progress * width)
  const empty = width - filled

  return (
    <Text>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
    </Text>
  )
}

const ActiveAgentsPanel: React.FC<{ agents: AgentActivity[] }> = ({ agents }) => {
  const totalTokens = agents.reduce((sum, agent) => sum + agent.tokensUsed, 0)

  return (
    <Box
      borderStyle="double"
      borderColor="magenta"
      padding={1}
      marginBottom={1}
      flexDirection="column"
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">
          🤝 Multi-Agent Collaboration
        </Text>
        <Text dimColor>
          {' • '}{agents.filter(a => a.status === 'active').length} active
          {' • '}{totalTokens} tokens total
        </Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2}>
        {agents.map((agent, idx) => (
          <AgentCard key={idx} agent={agent} />
        ))}
      </Box>
    </Box>
  )
}

const AgentCard: React.FC<{ agent: AgentActivity }> = ({ agent }) => {
  const statusIcons = {
    active: '🟢',
    waiting: '🟡',
    completed: '✅',
  }

  const statusColors = {
    active: 'green',
    waiting: 'yellow',
    completed: 'blue',
  }

  return (
    <Box marginY={0} flexDirection="column">
      <Box>
        <Text>
          {statusIcons[agent.status]}{' '}
          <Text bold color={statusColors[agent.status]}>
            {agent.specialty.toUpperCase()}
          </Text>
          <Text dimColor> ({agent.id.split('-')[0]})</Text>
        </Text>
      </Box>
      <Box paddingLeft={3} flexDirection="column">
        {agent.currentTask && (
          <Text dimColor>Task: {agent.currentTask}</Text>
        )}
        <Text dimColor>
          Tokens: <Text color="cyan">{agent.tokensUsed}</Text>
        </Text>
      </Box>
    </Box>
  )
}
