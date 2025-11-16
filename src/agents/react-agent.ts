/**
 * ReAct Agent
 *
 * Reasoning + Action pattern that interleaves thinking with tool execution.
 * Uses the extended thinking system for deep reasoning combined with
 * real-time tool use and observation.
 */

import { BaseLLMProvider } from '../llm/base-provider';
import { ThinkingStepManager } from '../core/thinking/thinking-step-manager';
import { CritiqueEngine } from '../core/thinking/critique-engine';
import { AgentResponse, AgenticPattern } from '../types/agents';
import { MCPTool } from '../mcp';

export interface ReActStep {
  thought: string;          // Reasoning step
  action?: {                // Tool action (optional)
    tool: string;
    input: any;
  };
  observation?: string;     // Tool result
  answer?: string;          // Final answer (terminal step)
}

export interface ReActAgentConfig {
  maxSteps?: number;        // Max reasoning steps (default: 15)
  maxToolCalls?: number;    // Max tool invocations (default: 10)
  enableThinking?: boolean; // Use extended thinking (default: true)
}

export class ReActAgent {
  private thinkingManager: ThinkingStepManager;
  private critiqueEngine: CritiqueEngine;
  private stepCount: number = 0;
  private toolCallCount: number = 0;

  constructor(
    private llmProvider: BaseLLMProvider,
    private tools: MCPTool[],
    private config: ReActAgentConfig = {}
  ) {
    this.thinkingManager = new ThinkingStepManager();
    this.critiqueEngine = new CritiqueEngine(llmProvider);
  }

  /**
   * Execute ReAct loop: Thought → Action → Observation → repeat
   */
  async execute(task: string, context?: any): Promise<AgentResponse> {
    const startTime = Date.now();
    const maxSteps = this.config.maxSteps ?? 15;
    const maxToolCalls = this.config.maxToolCalls ?? 10;

    this.stepCount = 0;
    this.toolCallCount = 0;

    const steps: ReActStep[] = [];
    let finalAnswer: string | null = null;

    while (this.stepCount < maxSteps && !finalAnswer) {
      this.stepCount++;

      // Generate next thought/action
      const step = await this.generateStep(task, steps, context);
      steps.push(step);

      // Record thinking
      this.thinkingManager.addStep('reasoning', step.thought, {
        confidence: 0.7,
      });

      // Execute action if present
      if (step.action && this.toolCallCount < maxToolCalls) {
        try {
          const observation = await this.executeAction(step.action);
          step.observation = observation;

          this.thinkingManager.addStep('observation', observation, {
            confidence: 0.8,
            metadata: { toolUsed: step.action.tool },
          });

          this.toolCallCount++;
        } catch (error: any) {
          step.observation = `Error: ${error.message}`;
          this.thinkingManager.addStep('observation', step.observation, {
            confidence: 0.3,
          });
        }
      }

      // Check if we have final answer
      if (step.answer) {
        finalAnswer = step.answer;
      }

      // Safety: if we're stuck in a loop, try to conclude
      if (this.stepCount >= maxSteps - 2 && !finalAnswer) {
        finalAnswer = await this.forceConclusion(task, steps);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      output: finalAnswer || 'Unable to complete task',
      metadata: {
        agent: 'react',
        pattern: 'tool-use' as AgenticPattern,
        steps: this.stepCount,
        toolsUsed: this.toolCallCount,
        duration,
        thinkingChain: this.thinkingManager.export(),
      },
    };
  }

  /**
   * Generate next ReAct step (thought + optional action)
   */
  private async generateStep(
    task: string,
    previousSteps: ReActStep[],
    context?: any
  ): Promise<ReActStep> {
    const prompt = this.buildReActPrompt(task, previousSteps, context);

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 800,
    });

    return this.parseReActResponse(response.text);
  }

  /**
   * Build ReAct prompt
   */
  private buildReActPrompt(
    task: string,
    previousSteps: ReActStep[],
    context?: any
  ): string {
    let prompt = `You are solving a task using the ReAct pattern (Reasoning + Action).

**Task:** ${task}

**Available Tools:**
${this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

**ReAct Format:**
For each step, provide:
1. Thought: Your reasoning about what to do next
2. Action: (Optional) Tool to use and input
3. Answer: (Only when you have the final answer)

`;

    if (previousSteps.length > 0) {
      prompt += `**Previous Steps:**\n`;
      previousSteps.forEach((step, i) => {
        prompt += `\nStep ${i + 1}:\n`;
        prompt += `Thought: ${step.thought}\n`;
        if (step.action) {
          prompt += `Action: ${step.action.tool}(${JSON.stringify(step.action.input)})\n`;
        }
        if (step.observation) {
          prompt += `Observation: ${step.observation}\n`;
        }
      });
      prompt += `\n`;
    }

    prompt += `**Next Step:**
Provide your response in this format:
Thought: [your reasoning]
Action: [tool_name]([input]) OR skip if no action needed
Answer: [final answer] OR skip if not ready to answer

Think step by step. Only provide Answer when you're confident you can fully solve the task.`;

    return prompt;
  }

  /**
   * Parse LLM response into ReActStep
   */
  private parseReActResponse(response: string): ReActStep {
    const step: ReActStep = {
      thought: '',
    };

    // Extract thought
    const thoughtMatch = response.match(/Thought:\s*(.+?)(?=\n(?:Action|Answer|$))/is);
    if (thoughtMatch) {
      step.thought = thoughtMatch[1].trim();
    }

    // Extract action
    const actionMatch = response.match(/Action:\s*(\w+)\((.*?)\)/is);
    if (actionMatch) {
      const toolName = actionMatch[1].trim();
      const inputStr = actionMatch[2].trim();

      try {
        const input = inputStr ? JSON.parse(inputStr) : {};
        step.action = { tool: toolName, input };
      } catch {
        // If JSON parse fails, use raw string
        step.action = { tool: toolName, input: inputStr };
      }
    }

    // Extract answer
    const answerMatch = response.match(/Answer:\s*(.+?)$/is);
    if (answerMatch && !answerMatch[1].includes('skip')) {
      step.answer = answerMatch[1].trim();
    }

    return step;
  }

  /**
   * Execute a tool action
   */
  private async executeAction(action: { tool: string; input: any }): Promise<string> {
    const tool = this.tools.find(t => t.name === action.tool);

    if (!tool) {
      throw new Error(`Unknown tool: ${action.tool}`);
    }

    const result = await tool.execute(action.input);
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  }

  /**
   * Force a conclusion when max steps reached
   */
  private async forceConclusion(task: string, steps: ReActStep[]): Promise<string> {
    const prompt = `Based on these reasoning steps, provide the best answer you can to the task.

**Task:** ${task}

**Steps taken:**
${steps.map((s, i) => `${i + 1}. ${s.thought}${s.observation ? ` → ${s.observation}` : ''}`).join('\n')}

Provide a final answer based on what you've learned:`;

    const response = await this.llmProvider.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      maxTokens: 1000,
    });

    return response.text;
  }

  /**
   * Reset for new task
   */
  reset(): void {
    this.thinkingManager = new ThinkingStepManager();
    this.stepCount = 0;
    this.toolCallCount = 0;
  }
}
