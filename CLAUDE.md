# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Duker is a terminal-based AI coding assistant that leverages agentic patterns to provide intelligent, context-aware coding assistance. Built on DukeCode design principles, Duker routes user requests through specialized agent patterns to deliver optimal solutions using the most appropriate LLM and tools.

## Technology Stack

- **Runtime**: Node.js
- **Primary Language**: TypeScript
- **Secondary Language**: JavaScript
- **Frontend Framework**: Vue 3 (for terminal UI)
- **AI Framework**: Vercel AI SDK (multi-provider LLM support)
- **Environment**: Terminal/CLI application

## Core Architecture: Agentic Pattern System

Duker implements an **Orchestrator-Workers pattern** with intelligent routing and security:

```
User Input → Router Agent → Security Layer → Pattern Selection → Specialized Agent(s)
                                ↓                                        ↓
                    [Permission Check: Allow Once/Session/Always/Reject]
                                ↓                                        ↓
                    [Reflection, Tool Use, Planning, Multi-Agent] → LLM(s)
                                ↓
                    [MCP Tools: Shell, Web Search, Context, RAG]
                                ↓
                            Response
```

### Agentic Patterns Implemented

1. **Reflection Pattern**: Agents self-evaluate and iteratively refine outputs
2. **Tool Use Pattern**: Integration with MCP tools (shell, web search, RAG, context)
3. **ReAct Pattern**: Combined reasoning and action with external tool interaction
4. **Planning Pattern**: Break complex tasks into manageable subtasks
5. **Multi-Agent Pattern**: Specialized agents collaborate on complex problems

### Router Agent

The Router Agent analyzes user input to determine:
- Task complexity and type
- Optimal agentic pattern(s) to employ
- Most suitable LLM provider/model
- Required MCP tools and context

## Architecture Principles

### DukeCode Agentic-First Design

- **Simplicity First**: Always seek the simplest solution; add complexity only when clearly needed
- **Modular Agents**: Each agent has a single, well-defined responsibility
- **Dynamic Routing**: Intelligently select patterns and LLMs based on task requirements
- **Parallel Execution**: Break independent subtasks for concurrent processing
- **Self-Improvement**: Built-in reflection and critique mechanisms

### Implementation Standards

- **TypeScript-First**: Strict typing for agent interfaces and tool definitions
- **Vue 3 Composition API**: Reactive terminal UI components
- **Vercel AI SDK**: Unified interface for OpenAI, Anthropic, Google, and other providers
- **MCP Protocol**: Standardized tool integration (shell, web search, context, RAG)
- **Security Layer**: Permission-based system for safe operation execution
- **Error Handling**: Robust retry mechanisms and fallback strategies
- **Structured Output**: XML-like schemas for agent communication

## Development Commands

*Note: This section will be populated as the project structure is established. Common commands include:*

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type checking
npm run type-check
```

## Agent System Design

### Agent Hierarchy

```
Router Agent (Orchestrator)
├── Reflection Agent - Self-evaluation and iterative refinement
├── Tool Agent - External tool/API invocation
├── ReAct Agent - Reasoning + action loops
├── Planning Agent - Task decomposition and orchestration
└── Multi-Agent Coordinator - Multiple specialized agents collaboration
```

### LLM Provider Strategy

Via Vercel AI SDK, support multiple providers with intelligent selection:
- **Anthropic Claude**: Complex reasoning, long context, tool use
- **OpenAI GPT**: General purpose, fast iterations
- **Google Gemini**: Multi-modal tasks
- **Others**: Extensible to new providers via AI SDK

### MCP Tool Integration

**Model Context Protocol (MCP)** tools available to all agents:
- **Shell**: Execute terminal commands, run scripts
- **Web Search**: Real-time information retrieval
- **Context**: Codebase understanding, file analysis
- **RAG**: Vector database queries, semantic search

### Agent Communication Protocol

Agents use structured XML-like output for clarity:
```xml
<task_analysis>
  <complexity>high</complexity>
  <recommended_pattern>orchestrator-workers</recommended_pattern>
  <subtasks>
    <task type="research" agent="tool">Gather documentation</task>
    <task type="planning" agent="planning">Design architecture</task>
  </subtasks>
</task_analysis>
```

## Project Structure

```
src/
├── agents/           # Agent implementations
│   ├── router/      # Main orchestrator
│   ├── reflection/  # Self-evaluation agent
│   ├── tool/        # Tool invocation agent
│   ├── react/       # Reasoning + action agent
│   ├── planning/    # Task decomposition agent
│   └── multi/       # Multi-agent coordinator
├── security/        # Security layer & permission system
│   ├── permission-manager.ts
│   ├── permission-store.ts
│   ├── audit-logger.ts
│   └── risk-assessment.ts
├── llm/             # LLM provider abstractions (via AI SDK)
├── mcp/             # MCP tool implementations
│   ├── shell/
│   ├── web-search/
│   ├── context/
│   └── rag/
├── types/           # TypeScript interfaces & schemas
├── ui/              # Vue 3 terminal UI components
│   └── components/
│       └── PermissionDialog.vue  # Permission prompt UI
└── utils/           # Shared utilities
```

## Key Design Decisions

### Why Agentic Patterns?

Duker addresses complex coding tasks that require:
- Dynamic problem decomposition
- Multi-step reasoning with tool use
- Self-correction and refinement
- Access to external knowledge (web, codebase, docs)

### Why Vercel AI SDK?

- **Unified Interface**: Single API for multiple LLM providers
- **TypeScript Native**: First-class TypeScript support
- **Streaming Support**: Real-time response streaming
- **Tool Calling**: Built-in function/tool invocation
- **Framework Agnostic**: Works with Vue, React, Node.js

### Why MCP?

- **Standardization**: Common protocol for tool integration
- **Extensibility**: Easy to add new capabilities
- **Security**: Controlled, permission-based access
- **Composability**: Tools combine for complex workflows

## Security Layer

### Permission System

Duker implements a comprehensive permission system to protect users from unintended operations:

**Risk Levels:**
- **SAFE** (0): Read-only operations, auto-allowed
- **LOW** (1): Minimal impact (create files in project)
- **MEDIUM** (2): Moderate impact (modify existing files)
- **HIGH** (3): Significant impact (delete files, install packages)
- **CRITICAL** (4): System-level operations (shell commands, network access)

**Permission Scopes:**
- **Allow Once**: Execute this specific operation now
- **Allow for Session**: Allow until Duker exits (24 hours max)
- **Allow Always**: Don't ask again (saved to `.duker/permissions.json`)
- **Reject**: Do not execute (can be permanent blacklist)

### User Consent Flow

Before any potentially dangerous operation:

1. **Agent requests operation** (e.g., "run npm install")
2. **Security Layer assesses risk** (e.g., HIGH - package installation)
3. **UI displays permission dialog** with:
   - Operation description
   - Exact command/action that will execute
   - Risk level with color coding
   - Permission options
4. **User chooses** (Once/Session/Always/Reject)
5. **Decision saved** (if Always or Reject)
6. **Operation executes or cancels**

### Protected Operations

All MCP tools are wrapped with security checks:
- **Shell commands**: Risk-based on command type
- **File writes**: MEDIUM risk, always prompt
- **File deletes**: HIGH risk, always prompt
- **Network requests**: Context-dependent risk
- **Package operations**: HIGH risk (npm install, etc.)

See [Security Layer Specification](./docs/specs/security-layer.md) for complete details.
