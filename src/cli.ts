#!/usr/bin/env node

/**
 * Duker CLI Entry Point
 */

import { Command } from 'commander'
import dotenv from 'dotenv'
import chalk from 'chalk'
import { LLMManager, AnthropicProvider } from './llm/index.js'
import { PermissionManager } from './security/index.js'
import { ShellTool, ContextTool } from './mcp/index.js'
import { RouterAgent } from './agents/router-agent.js'
import { PermissionRequest, PermissionDecision } from './types/index.js'
import readline from 'readline'

// Load environment variables
dotenv.config()

const program = new Command()

program
  .name('duker')
  .description('Terminal-based AI coding assistant with agentic patterns')
  .version('0.1.0')

program
  .command('chat')
  .description('Start interactive chat session')
  .action(async () => {
    await startChat()
  })

program
  .command('ask <question>')
  .description('Ask a single question')
  .action(async (question: string) => {
    await askQuestion(question)
  })

program.parse()

/**
 * Start interactive chat session
 */
async function startChat() {
  console.log(chalk.cyan.bold('\\n🤖 Duker AI Coding Assistant\\n'))
  console.log(chalk.dim('Type your questions or tasks. Type "exit" to quit.\\n'))

  const { agent } = await initializeAgent()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const askLoop = () => {
    rl.question(chalk.green('You: '), async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log(chalk.cyan('\\nGoodbye! 👋\\n'))
        rl.close()
        process.exit(0)
      }

      if (!input.trim()) {
        askLoop()
        return
      }

      try {
        console.log(chalk.dim('\\nDuker is thinking...\\n'))

        const response = await agent.route({ task: input })

        if (response.success) {
          console.log(chalk.white(response.output))

          if (response.metadata) {
            console.log(
              chalk.dim(
                `\\n[${response.metadata.pattern} pattern | ${response.metadata.tokensUsed} tokens | ${response.metadata.duration}ms]\\n`
              )
            )
          }
        } else {
          if (response.userCancelled) {
            console.log(chalk.yellow('\\n⚠ Operation cancelled by user\\n'))
          } else {
            console.log(chalk.red(`\\n✗ Error: ${response.error}\\n`))
          }
        }
      } catch (error: any) {
        console.log(chalk.red(`\\n✗ Error: ${error.message}\\n`))
      }

      askLoop()
    })
  }

  askLoop()
}

/**
 * Ask a single question
 */
async function askQuestion(question: string) {
  console.log(chalk.cyan.bold('\\n🤖 Duker AI Coding Assistant\\n'))

  const { agent } = await initializeAgent()

  try {
    console.log(chalk.dim('Thinking...\\n'))

    const response = await agent.route({ task: question })

    if (response.success) {
      console.log(chalk.white(response.output))

      if (response.metadata) {
        console.log(
          chalk.dim(
            `\\n[${response.metadata.pattern} pattern | ${response.metadata.tokensUsed} tokens | ${response.metadata.duration}ms]`
          )
        )
      }
    } else {
      if (response.userCancelled) {
        console.log(chalk.yellow('⚠ Operation cancelled by user'))
      } else {
        console.log(chalk.red(`✗ Error: ${response.error}`))
      }
    }

    console.log() // Empty line
  } catch (error: any) {
    console.log(chalk.red(`\\n✗ Error: ${error.message}\\n`))
    process.exit(1)
  }
}

/**
 * Initialize the agent system
 */
async function initializeAgent() {
  // Check for required API keys
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      chalk.red(
        '\\n✗ Error: ANTHROPIC_API_KEY not found in environment variables\\n'
      )
    )
    console.log(
      chalk.dim('Create a .env file with: ANTHROPIC_API_KEY=your_key_here\\n')
    )
    process.exit(1)
  }

  // Initialize LLM Manager
  const llmManager = new LLMManager('anthropic')
  const anthropicProvider = new AnthropicProvider(
    process.env.ANTHROPIC_API_KEY,
    process.env.DUKER_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022'
  )
  llmManager.registerProvider(anthropicProvider)

  // Initialize Permission Manager
  const permissionManager = new PermissionManager()

  // Set up permission UI callback (terminal-based)
  permissionManager.setUICallback(async (request: PermissionRequest) => {
    return await promptPermission(request)
  })

  // Initialize Router Agent
  const agent = new RouterAgent(llmManager, permissionManager)

  // Register tools
  const shellTool = new ShellTool(permissionManager, 'router')
  const contextTool = new ContextTool(permissionManager, 'router')

  agent.registerTool(shellTool)
  agent.registerTool(contextTool)

  return { agent, llmManager, permissionManager }
}

/**
 * Terminal-based permission prompt
 */
async function promptPermission(
  request: PermissionRequest
): Promise<PermissionDecision> {
  console.log(chalk.yellow.bold('\\n⚠ Permission Required\\n'))
  console.log(chalk.white(`Agent: ${request.agent}`))
  console.log(chalk.white(`Operation: ${request.operation.description}`))
  console.log(chalk.white(`Action: ${request.operation.action}`))
  console.log(
    chalk.white(`Risk Level: ${getRiskLevelText(request.operation.riskLevel)}\\n`)
  )

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    console.log(chalk.cyan('Options:'))
    console.log(chalk.white('  1. Allow once'))
    console.log(chalk.white('  2. Allow for session'))
    console.log(chalk.white('  3. Allow always'))
    console.log(chalk.white('  4. Reject\\n'))

    rl.question(chalk.green('Choice (1-4): '), (answer) => {
      rl.close()

      const choice = parseInt(answer)
      let decision: PermissionDecision

      switch (choice) {
        case 1:
          decision = { granted: true, scope: 'once' }
          break
        case 2:
          decision = {
            granted: true,
            scope: 'session',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          }
          break
        case 3:
          decision = { granted: true, scope: 'always' }
          break
        default:
          decision = { granted: false, scope: 'never' }
      }

      console.log() // Empty line
      resolve(decision)
    })
  })
}

/**
 * Get risk level text with color
 */
function getRiskLevelText(level: number): string {
  switch (level) {
    case 0:
      return chalk.green('SAFE')
    case 1:
      return chalk.blue('LOW')
    case 2:
      return chalk.yellow('MEDIUM')
    case 3:
      return chalk.hex('#FFA500')('HIGH') // Orange
    case 4:
      return chalk.red('CRITICAL')
    default:
      return chalk.gray('UNKNOWN')
  }
}
