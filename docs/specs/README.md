# Duker Architecture Specifications

This directory contains detailed technical specifications for all components of the Duker agentic AI coding assistant.

## Overview

Duker is a terminal-based AI coding assistant that uses agentic patterns to provide intelligent, context-aware assistance. The system employs an orchestrator-workers architecture with specialized agents, multi-LLM support, and MCP tool integration.

## Core Architecture Documents

### 1. [Router Agent](./router-agent.md)
The central orchestrator that analyzes user input and routes requests to appropriate agent patterns and LLM providers.

**Key Topics:**
- Input analysis and intent classification
- Pattern selection logic
- LLM provider selection strategy
- Execution coordination
- Error handling and fallbacks

### 2. Agentic Patterns

#### [Reflection Pattern](./reflection-pattern.md)
Self-evaluation and iterative refinement for high-quality outputs.

**Key Topics:**
- Generate → Evaluate → Refine loop
- Quality assessment criteria
- Iteration strategies
- Use cases and anti-patterns

#### [Tool Use Pattern](./tool-use-pattern.md)
External tool and API integration for extended capabilities.

**Key Topics:**
- MCP tool integration
- Function calling with Vercel AI SDK
- Sequential vs parallel execution
- Tool selection logic

#### [ReAct Pattern](./react-pattern.md)
Reasoning + Acting loop for complex problem-solving.

**Key Topics:**
- Thought → Action → Observation cycle
- Action types and execution
- Termination conditions
- Stuck detection and recovery

#### [Planning Pattern](./planning-pattern.md)
Task decomposition and orchestrated execution of subtasks.

**Key Topics:**
- Task analysis and plan creation
- Dependency resolution
- Wave-based parallel execution
- Dynamic re-planning

#### [Multi-Agent Pattern](./multi-agent-pattern.md)
Multiple specialized agents collaborating on complex tasks.

**Key Topics:**
- Specialist agent types
- Coordination strategies
- Agent communication
- Conflict resolution

## Infrastructure Layers

### 3. [Security Layer](./security-layer.md)
Permission-based system for safe operation execution.

**Key Topics:**
- Permission system architecture
- Risk level classification (SAFE to CRITICAL)
- Permission scopes (Once/Session/Always/Reject)
- User consent flow
- Permission storage and audit logging
- Integration with all tools and agents

### 4. [LLM Provider Layer](./llm-provider-layer.md)
Unified interface for multiple LLM providers via Vercel AI SDK.

**Key Topics:**
- Provider implementations (Anthropic, OpenAI, Google)
- Model selection strategy
- Error handling and retry logic
- Cost tracking and monitoring
- Caching strategies

### 5. [MCP Tools](./mcp-tools.md)
Model Context Protocol tools for agent capabilities.

**Key Topics:**
- **Shell Tool**: Terminal command execution with security
- **Web Search Tool**: Real-time information retrieval
- **Context Tool**: Codebase analysis and understanding
- **RAG Tool**: Semantic search with vector databases
- Security layer integration
- Risk assessment by tool operation

### 6. [Agent Communication Protocol](./agent-communication.md)
Message-based communication system for agent coordination.

**Key Topics:**
- Message structure and types
- Message bus implementations
- Communication patterns (request-response, pub-sub, collaboration)
- Security and encryption
- Monitoring and validation

### 7. [UI Layer](./ui-layer.md)
Terminal interface built with Vue 3 and Ink.

**Key Topics:**
- Component architecture
- Permission dialog component
- Streaming response rendering
- Interactive elements
- State management
- Keyboard shortcuts
- Themes and accessibility

## Quick Reference

### System Flow

```
User Input
    ↓
Router Agent (analyzes intent, selects pattern/LLM)
    ↓
Security Layer (checks permissions, prompts user if needed)
    ↓                                    ↓
[Permission Denied] ←───────────→ [Permission Granted]
    ↓                                    ↓
User Notified                Pattern Agent(s) (Reflection/Tool Use/ReAct/Planning/Multi-Agent)
                                         ↓
                            LLM Provider Layer (Anthropic/OpenAI/Google via AI SDK)
                                         ↓
                            MCP Tools (Shell/Web Search/Context/RAG)
                                         ↓
                            Agent Communication (message passing)
                                         ↓
                            UI Layer (Vue 3 terminal interface)
                                         ↓
                                  Result to User
```

### Key Technologies

- **Language**: TypeScript, JavaScript
- **Framework**: Node.js, Vue 3
- **AI SDK**: Vercel AI SDK
- **LLM Providers**: Anthropic Claude, OpenAI GPT, Google Gemini
- **Terminal UI**: Ink, Chalk
- **Message Bus**: Redis (production), In-memory (development)
- **Vector DB**: ChromaDB (for RAG)
- **Search**: Tavily, Serper

### Design Principles

1. **Security First**: Always request user permission for dangerous operations
2. **Simplicity First**: Start with the simplest solution
3. **Modular Design**: Each component has a single responsibility
4. **Dynamic Routing**: Select optimal patterns and LLMs per task
5. **Parallel Execution**: Maximize concurrency where possible
6. **Error Resilience**: Graceful degradation and fallbacks
7. **Self-Improvement**: Built-in reflection and iteration
8. **Extensibility**: Easy to add new agents, tools, and providers
9. **Transparency**: Show users exactly what will be executed
10. **Auditability**: Log all operations for security review

## Implementation Phases

### Phase 1: Foundation
- **Security Layer** (permission system, audit logging)
- Basic router agent with security integration
- LLM provider layer with Vercel AI SDK
- Simple terminal UI with permission dialogs
- Core MCP tools (Shell, Context) wrapped with security

### Phase 2: Core Patterns
- Reflection pattern
- Tool Use pattern
- Planning pattern
- Enhanced UI with streaming
- Web Search and RAG tools

### Phase 3: Advanced Patterns
- ReAct pattern
- Multi-Agent pattern
- Advanced communication protocol
- Permission analytics and optimization

### Phase 4: Optimization & Production
- Caching and performance tuning
- Cost optimization
- Advanced monitoring and security analytics
- Production deployment with hardened security

## File Size Reference

| Specification | Lines | Complexity |
|--------------|-------|------------|
| Router Agent | ~280 | Medium |
| Reflection Pattern | ~350 | Medium |
| Tool Use Pattern | ~450 | High |
| ReAct Pattern | ~400 | High |
| Planning Pattern | ~550 | High |
| Multi-Agent Pattern | ~550 | Very High |
| **Security Layer** | **~750** | **Very High** |
| LLM Provider Layer | ~600 | High |
| MCP Tools | ~1000 | Very High |
| Agent Communication | ~650 | High |
| UI Layer | ~700 | High |

## Contributing

When adding new specifications:
1. Follow the existing structure and format
2. Include TypeScript interfaces for all major components
3. Provide implementation examples
4. Document use cases and anti-patterns
5. Include best practices section
6. Add diagrams where helpful

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - High-level architecture overview
- Implementation will be in `/src` directory
- Tests will be in `/tests` directory
- Configuration in `/config` directory

## Questions?

These specifications are living documents. As implementation proceeds, they should be updated to reflect actual implementation details and learnings.
