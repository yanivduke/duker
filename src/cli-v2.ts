#!/usr/bin/env node

/**
 * Duker CLI V2 - Enhanced with all agentic patterns
 */

import { Command } from 'commander'
import dotenv from 'dotenv'
import chalk from 'chalk'
import ora from 'ora'
import { LLMManager, AnthropicProvider } from './llm/index.js'
import { PermissionManager } from './security/index.js'
import { ShellTool, ContextTool, WebSearchTool } from './mcp/index.js'
import { RouterAgentV2 } from './agents/index.js'
import { PermissionRequest, PermissionDecision } from './types/index.js'
import readline from 'readline'

// Load environment variables
dotenv.config()

const program = new Command()

program
  .name('duker')
  .description('Terminal-based AI coding assistant with agentic patterns v2')
  .version('0.2.0')

program
  .command('chat')
  .description('Start interactive chat session with enhanced agentic patterns')
  .option('-p, --pattern <pattern>', 'Force specific pattern (direct, reflection, tool-use, planning)')
  .action(async (options) => {
    await startChat(options.pattern)
  })

program
  .command('ask <question>')
  .description('Ask a single question')
  .option('-p, --pattern <pattern>', 'Force specific pattern')
  .action(async (question: string, options) => {
    await askQuestion(question, options.pattern)
  })

program.parse()

/**
 * Start interactive chat session
 */
async function startChat(forcePattern?: string) {
  console.log(chalk.cyan.bold('\n🤖 Duker AI Coding Assistant v2\n'))
  console.log(chalk.dim('Enhanced with: Reflection, Tool Use, and Planning patterns'))
  console.log(chalk.dim('Type your questions or tasks. Type "exit" to quit.\n'))

  const { agent } = await initializeAgent()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const askLoop = () => {
    rl.question(chalk.green('You: '), async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log(chalk.cyan('\nGoodbye! 👋\n'))
        rl.close()
        process.exit(0)
      }

      if (!input.trim()) {
        askLoop()
        return
      }

      try {
        const spinner = ora({
          text: chalk.dim('Analyzing task...'),
          color: 'cyan',
        }).start()

        const response = await agent.route({ task: input })

        spinner.stop()

        if (response.success) {
          console.log(chalk.white(`\n${response.output}\n`))

          if (response.metadata) {
            const pattern = response.metadata.pattern.toUpperCase()
            const patternColor = getPatternColor(response.metadata.pattern)

            console.log(chalk.dim('━'.repeat(60)))
            console.log(
              chalk.dim(`Pattern: `) +
                patternColor(pattern) +
                chalk.dim(` | ${response.metadata.tokensUsed || 0} tokens | ${response.metadata.duration}ms`)
            )

            if (response.metadata.iterations) {
              console.log(
                chalk.dim(`Iterations: ${response.metadata.iterations}`)
              )
            }

            if (response.metadata.finalQuality) {
              const quality = response.metadata.finalQuality
              const qualityColor = quality >= 0.90 ? chalk.green : quality >= 0.80 ? chalk.cyan : quality >= 0.70 ? chalk.yellow : chalk.red

              // Check if it's the enhanced V2 (quality >= 0.90 threshold indicates V2)
              const isV2 = quality >= 0.85 && response.metadata.pattern === 'reflection'

              console.log(
                chalk.dim(`Quality: `) + qualityColor(`${(quality * 100).toFixed(1)}%`) +
                (isV2 ? chalk.magenta(' [V2]') : '')
              )
            }

            if (response.metadata.toolsUsed && response.metadata.toolsUsed.length > 0) {
              console.log(
                chalk.dim(`Tools: ${response.metadata.toolsUsed.join(', ')}`)
              )
            }

            console.log(chalk.dim('━'.repeat(60)) + '\n')
          }
        } else {
          if (response.userCancelled) {
            console.log(chalk.yellow('\n⚠ Operation cancelled by user\n'))
          } else {
            console.log(chalk.red(`\n✗ Error: ${response.error}\n`))
          }
        }
      } catch (error: any) {
        console.log(chalk.red(`\n✗ Error: ${error.message}\n`))
      }

      askLoop()
    })
  }

  askLoop()
}

/**
 * Ask a single question
 */
async function askQuestion(question: string, forcePattern?: string) {
  console.log(chalk.cyan.bold('\n🤖 Duker AI Coding Assistant v2\n'))

  const { agent } = await initializeAgent()

  try {
    const spinner = ora({
      text: chalk.dim('Analyzing and processing...'),
      color: 'cyan',
    }).start()

    const response = await agent.route({ task: question })

    spinner.stop()

    if (response.success) {
      console.log(chalk.white(`\n${response.output}\n`))

      if (response.metadata) {
        const pattern = response.metadata.pattern.toUpperCase()
        const patternColor = getPatternColor(response.metadata.pattern)

        console.log(chalk.dim('━'.repeat(60)))
        console.log(
          chalk.dim(`Pattern: `) +
            patternColor(pattern) +
            chalk.dim(` | ${response.metadata.tokensUsed || 0} tokens | ${response.metadata.duration}ms`)
        )

        if (response.metadata.iterations) {
          console.log(chalk.dim(`Iterations: ${response.metadata.iterations}`))
        }

        if (response.metadata.finalQuality) {
          const quality = response.metadata.finalQuality
          const qualityColor = quality >= 0.85 ? chalk.green : quality >= 0.7 ? chalk.yellow : chalk.red
          console.log(
            chalk.dim(`Quality: `) + qualityColor(`${(quality * 100).toFixed(1)}%`)
          )
        }

        console.log(chalk.dim('━'.repeat(60)) + '\n')
      }
    } else {
      if (response.userCancelled) {
        console.log(chalk.yellow('⚠ Operation cancelled by user'))
      } else {
        console.log(chalk.red(`✗ Error: ${response.error}`))
      }
    }

    console.log()
  } catch (error: any) {
    console.log(chalk.red(`\n✗ Error: ${error.message}\n`))
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
      chalk.red('\n✗ Error: ANTHROPIC_API_KEY not found in environment variables\n')
    )
    console.log(chalk.dim('Create a .env file with: ANTHROPIC_API_KEY=your_key_here\n'))
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

  // Set up permission UI callback
  permissionManager.setUICallback(async (request: PermissionRequest) => {
    return await promptPermission(request)
  })

  // Initialize Router Agent V2
  const agent = new RouterAgentV2(
    llmManager,
    permissionManager,
    process.env.ANTHROPIC_API_KEY
  )

  // Register tools
  const shellTool = new ShellTool(permissionManager, 'router-v2')
  const contextTool = new ContextTool(permissionManager, 'router-v2')
  const webSearchTool = new WebSearchTool(permissionManager, 'router-v2')

  agent.registerTool(shellTool)
  agent.registerTool(contextTool)
  agent.registerTool(webSearchTool)

  return { agent, llmManager, permissionManager }
}

/**
 * Terminal-based permission prompt
 */
async function promptPermission(request: PermissionRequest): Promise<PermissionDecision> {
  console.log(chalk.yellow.bold('\n⚠ Permission Required\n'))
  console.log(chalk.white(`Agent: ${request.agent}`))
  console.log(chalk.white(`Operation: ${request.operation.description}`))
  console.log(chalk.white(`Action: ${request.operation.action}`))
  console.log(
    chalk.white(`Risk Level: ${getRiskLevelText(request.operation.riskLevel)}\n`)
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
    console.log(chalk.white('  4. Reject\n'))

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

      console.log()
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
      return chalk.hex('#FFA500')('HIGH')
    case 4:
      return chalk.red('CRITICAL')
    default:
      return chalk.gray('UNKNOWN')
  }
}

/**
 * Get pattern color
 */
function getPatternColor(pattern: string) {
  switch (pattern) {
    case 'direct':
      return chalk.gray
    case 'reflection':
      return chalk.blue
    case 'tool-use':
      return chalk.green
    case 'planning':
      return chalk.magenta
    case 'react':
      return chalk.cyan
    default:
      return chalk.white
  }
}
