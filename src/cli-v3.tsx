#!/usr/bin/env node
/**
 * Duker CLI V3 - Vue3/Ink Terminal UI with Smart Iteration
 * Phase 3: Interactive chat with agent visualization
 */

import React, { useState, useEffect } from 'react'
import { render } from 'ink'
import { Command } from 'commander'
import dotenv from 'dotenv'
import { ChatInterface, Message } from './ui/components/ChatInterface.js'
import { RouterAgentV2 } from './agents/index.js'
import { LLMManager } from './llm/index.js'
import { PermissionManager } from './security/index.js'
import { IterationManager, IterationState } from './core/iteration-manager.js'
import { ShellTool } from './mcp/shell-tool.js'
import { ContextTool } from './mcp/context-tool.js'
import { WebSearchTool } from './mcp/web-search-tool.js'
import chalk from 'chalk'

dotenv.config()

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: '🤖 Welcome to Duker AI Assistant (Phase 3)! How can I help you today?',
      timestamp: Date.now(),
    },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [iterationState, setIterationState] = useState<IterationState>()
  const [currentPattern, setCurrentPattern] = useState<string>()

  // Initialize services
  const [services] = useState(() => initializeServices())

  const handleMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])

    // Check for special commands
    if (content.toLowerCase() === 'exit' || content.toLowerCase() === 'quit') {
      process.exit(0)
    }

    if (content.toLowerCase() === 'clear') {
      setMessages([])
      return
    }

    if (content.toLowerCase() === 'help') {
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: `Available commands:
• Type any question or coding task
• "clear" - Clear chat history
• "exit" or "quit" - Exit Duker
• Press ESC - Quick exit

I can help you with:
- Code generation (with tests & docs)
- Refactoring and debugging
- File operations
- Web searches
- Complex multi-step tasks`,
          timestamp: Date.now(),
        },
      ])
      return
    }

    // Process with agent
    setIsProcessing(true)

    try {
      const response = await processWithIterationTracking(
        services.router,
        content,
        (state) => setIterationState(state),
        (pattern) => setCurrentPattern(pattern)
      )

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.output,
        timestamp: Date.now(),
        metadata: {
          pattern: response.metadata?.pattern,
          quality: response.metadata?.finalQuality,
          tokens: response.metadata?.tokensUsed,
          duration: response.metadata?.duration,
        },
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: `❌ Error: ${error.message}`,
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsProcessing(false)
      setIterationState(undefined)
      setCurrentPattern(undefined)
    }
  }

  return (
    <ChatInterface
      messages={messages}
      onMessage={handleMessage}
      isProcessing={isProcessing}
      iterationState={iterationState}
      currentPattern={currentPattern}
    />
  )
}

function initializeServices() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error(chalk.red('Error: ANTHROPIC_API_KEY not found in .env'))
    process.exit(1)
  }

  const llmManager = new LLMManager()
  const permissionManager = new PermissionManager((request) =>
    Promise.resolve({ granted: true, scope: 'session' as const })
  )

  const router = new RouterAgentV2(llmManager, permissionManager, apiKey)

  // Register tools
  const shellTool = new ShellTool(permissionManager)
  const contextTool = new ContextTool(permissionManager)
  const webSearchTool = new WebSearchTool(permissionManager)

  router.registerTool(shellTool)
  router.registerTool(contextTool)
  router.registerTool(webSearchTool)

  return { router, llmManager, permissionManager }
}

async function processWithIterationTracking(
  router: RouterAgentV2,
  task: string,
  onProgress: (state: IterationState) => void,
  onPatternChange: (pattern: string) => void
): Promise<any> {
  const iterationManager = new IterationManager({
    maxIterations: 5,
    maxDuration: 180000, // 3 minutes
    minProgress: 0.1,
    stallThreshold: 2,
    tokenBudget: 50000,
  })

  iterationManager.onProgress(onProgress)

  // Start first cycle
  const cycle = iterationManager.startCycle()

  // Analysis step
  const analysisStep = iterationManager.addStep('Analyzing task')
  iterationManager.updateStep(analysisStep.id, { status: 'in_progress', progress: 0.5 })

  const response = await router.route({ task })

  if (response.metadata?.pattern) {
    onPatternChange(response.metadata.pattern)
  }

  iterationManager.updateStep(analysisStep.id, {
    status: 'completed',
    progress: 1,
    metadata: { pattern: response.metadata?.pattern },
  })

  // Processing step
  const processingStep = iterationManager.addStep('Processing with agent')
  iterationManager.updateStep(processingStep.id, { status: 'in_progress', progress: 0.5 })

  if (response.success) {
    iterationManager.updateStep(processingStep.id, { status: 'completed', progress: 1 })
  } else {
    iterationManager.updateStep(processingStep.id, {
      status: 'failed',
      progress: 0,
      error: response.error,
    })
  }

  iterationManager.completeCycle(response.metadata?.tokensUsed || 0)

  return response
}

// CLI Setup
const program = new Command()

program
  .name('duker')
  .description('Duker AI Coding Assistant - Phase 3')
  .version('0.3.0')

program
  .command('chat')
  .description('Start interactive chat (Vue3/Ink UI)')
  .action(() => {
    render(<App />)
  })

program
  .command('ask <question>')
  .description('Ask a single question')
  .action(async (question: string) => {
    console.log(chalk.cyan('\n🤖 Duker AI Assistant\n'))

    const services = initializeServices()
    const iterationManager = new IterationManager()

    try {
      const cycle = iterationManager.startCycle()
      const step = iterationManager.addStep('Processing question')
      iterationManager.updateStep(step.id, { status: 'in_progress' })

      const response = await services.router.route({ task: question })

      iterationManager.updateStep(step.id, { status: 'completed', progress: 1 })
      iterationManager.completeCycle(response.metadata?.tokensUsed || 0)

      if (response.success) {
        console.log(chalk.white(response.output))
        console.log()

        if (response.metadata) {
          console.log(chalk.dim('─'.repeat(60)))
          console.log(
            chalk.dim(`Pattern: `) +
              chalk.magenta(response.metadata.pattern?.toUpperCase() || 'DIRECT') +
              chalk.dim(` | ${response.metadata.tokensUsed || 0} tokens | ${response.metadata.duration || 0}ms`)
          )

          if (response.metadata.finalQuality) {
            const quality = response.metadata.finalQuality
            const qualityColor = quality >= 0.9 ? chalk.green : quality >= 0.8 ? chalk.cyan : chalk.yellow
            console.log(
              chalk.dim(`Quality: `) +
                qualityColor(`${(quality * 100).toFixed(1)}%`) +
                (quality >= 0.85 ? chalk.magenta(' [V2]') : '')
            )
          }

          console.log(chalk.dim('─'.repeat(60)))
        }

        console.log(chalk.dim('\n' + iterationManager.getDetailedReport()))
      } else {
        console.error(chalk.red(`\n✗ Error: ${response.error}\n`))
      }
    } catch (error: any) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`))
      process.exit(1)
    }
  })

program.parse()
