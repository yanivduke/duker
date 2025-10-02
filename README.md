# Duker 🤖

**Version 0.3.0** - Smart Iteration & Terminal UI

A terminal-based AI coding assistant with smart iteration management and interactive UI, designed for secure and intelligent code assistance.

> **Latest Updates (v0.3.0 - Phase 3)**:
> - 🔄 **Smart Iteration Manager**: Prevents endless loops with 6 stop conditions
> - 💬 **Interactive Terminal UI**: React/Ink-powered chat interface
> - 📊 **Real-time Progress**: Live visualization of agent steps
> - ⚡ **Loop Prevention**: Automatic stall detection and token budgets
> - 🎨 **Beautiful UX**: Progress bars, spinners, and color-coded status
>
> See [PHASE3_SUMMARY.md](./PHASE3_SUMMARY.md) for Phase 3 details.
> Previous: [docs/REFLECTION_V2.md](./docs/REFLECTION_V2.md) for Phase 2.1 details.

## Features

- **🔒 Security First**: Permission-based system for all operations (Allow Once/Session/Always/Reject)
- **🧠 Agentic Patterns**: Intelligent routing through Reflection V2, Tool Use, Planning, and Multi-Agent patterns
- **🎯 Advanced Code Generation**: 10-dimensional quality analysis (correctness, security, maintainability, testability, etc.)
- **🧪 Auto Test Generation**: Comprehensive test suites with edge cases and error scenarios
- **📚 Smart Documentation**: Automatic function docs, usage examples, and API documentation
- **🔍 Code Analysis**: Language-specific best practices, code smell detection, refactoring suggestions
- **🤖 Multi-LLM Support**: Powered by Vercel AI SDK (Anthropic Claude, OpenAI GPT, Google Gemini)
- **🛠️ MCP Tools**: Shell execution, file operations, web search, codebase analysis
- **📊 Audit Logging**: Complete logging of all operations and permissions
- **⚡ TypeScript**: Fully typed with strict TypeScript

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- An Anthropic API key (get one at https://console.anthropic.com/)

### Installation

1. **Clone the repository**

```bash
cd duker
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment**

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
ANTHROPIC_API_KEY=your_anthropic_key_here
```

4. **Run Duker**

```bash
npm run dev chat
```

Or ask a single question:

```bash
npm run dev ask "How do I create a React component?"
```

## Usage

### Interactive Chat

```bash
npm run dev chat
```

Start a conversation with Duker. Type your questions or coding tasks, and Duker will assist you.

### Single Question

```bash
npm run dev ask "Explain async/await in JavaScript"
```

### Security Permissions

When Duker needs to perform an operation (like running a command or modifying a file), you'll be prompted:

```
⚠ Permission Required

Agent: router
Operation: Execute shell command: npm test
Action: npm test
Risk Level: MEDIUM

Options:
  1. Allow once
  2. Allow for session
  3. Allow always
  4. Reject

Choice (1-4):
```

**Permission Scopes:**
- **Allow Once**: Execute this specific operation now
- **Allow for Session**: Allow until Duker exits (24 hours max)
- **Allow Always**: Don't ask again (saved to `.duker/permissions.json`)
- **Reject**: Do not execute

**Risk Levels:**
- 🟢 **SAFE** (0): Read-only operations, auto-allowed
- 🔵 **LOW** (1): Minimal impact (create files in project)
- 🟡 **MEDIUM** (2): Moderate impact (modify existing files)
- 🟠 **HIGH** (3): Significant impact (delete files, install packages)
- 🔴 **CRITICAL** (4): System-level operations (dangerous shell commands)

## Architecture

Duker uses an **Orchestrator-Workers** pattern with intelligent routing:

```
User Input → Router Agent → Security Layer → Pattern Selection → Specialized Agent(s)
                                ↓                                        ↓
                    [Permission Check: Allow Once/Session/Always/Reject]
                                ↓                                        ↓
                    [Reflection, Tool Use, Planning, Multi-Agent] → LLM(s)
                                ↓
                    [MCP Tools: Shell, Context]
                                ↓
                            Response
```

### Core Components

- **Security Layer**: Permission management, risk assessment, audit logging
- **LLM Provider Layer**: Unified interface for multiple LLM providers (Anthropic, OpenAI, Google)
- **MCP Tools**: Secure tool execution (Shell, Context/File operations)
- **Router Agent**: Intelligent task routing and pattern selection
- **Agentic Patterns**: Specialized execution patterns (Direct, Reflection, Tool Use, Planning, Multi-Agent)

## Project Structure

```
duker/
├── src/
│   ├── agents/                   # Agent implementations
│   │   ├── router-agent.ts       # Phase 1 router
│   │   ├── router-agent-v2.ts    # Phase 2 enhanced router
│   │   ├── reflection-agent.ts   # Self-evaluation pattern
│   │   ├── tool-use-agent.ts     # Function calling pattern
│   │   └── planning-agent.ts     # Task decomposition pattern
│   ├── security/                 # Security layer
│   │   ├── permission-manager.ts
│   │   ├── permission-store.ts
│   │   ├── audit-logger.ts
│   │   └── risk-assessment.ts
│   ├── llm/                      # LLM providers
│   │   ├── llm-manager.ts
│   │   └── providers/
│   │       └── anthropic-provider.ts
│   ├── mcp/                      # MCP tools
│   │   ├── shell-tool.ts
│   │   ├── context-tool.ts
│   │   └── web-search-tool.ts    # Tavily search
│   ├── types/                    # TypeScript types
│   │   └── index.ts
│   ├── cli.ts                    # CLI v1 entry point
│   └── cli-v2.ts                 # CLI v2 entry point (enhanced)
├── docs/                         # Documentation
│   └── specs/                    # Detailed specifications
├── .duker/                       # User data (created at runtime)
│   ├── permissions.json          # Saved permissions
│   └── audit.log                 # Security audit log
├── CLAUDE.md                     # Architecture guide
├── CHANGELOG.md                  # Version history
└── package.json
```

## Development

### Build

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Testing

```bash
npm test
```

## Configuration

### Environment Variables

- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)
- `OPENAI_API_KEY`: Your OpenAI API key (optional)
- `GOOGLE_API_KEY`: Your Google API key (optional)
- `TAVILY_API_KEY`: Your Tavily API key for web search (optional)
- `DUKER_DEFAULT_PROVIDER`: Default LLM provider (default: 'anthropic')
- `DUKER_DEFAULT_MODEL`: Default model (default: 'claude-3-5-sonnet-20241022')
- `DEBUG`: Enable debug logging (default: false)

### Permissions Management

Permissions are stored in `.duker/permissions.json`. You can:

1. **View permissions**: Check the file directly
2. **Revoke permissions**: Delete specific entries or the entire file
3. **Audit operations**: Review `.duker/audit.log`

## Security

Duker is designed with security as the top priority:

- ✅ **Explicit Consent**: Never executes dangerous operations without user approval
- ✅ **Risk Assessment**: Every operation is classified by risk level
- ✅ **Audit Logging**: All operations and permissions are logged
- ✅ **Granular Control**: Per-operation and per-resource permissions
- ✅ **Blacklist Support**: Permanently block dangerous operations
- ✅ **Least Privilege**: Operations only granted minimal necessary permissions

## Documentation

Detailed specifications are available in the `docs/specs/` directory:

- [Security Layer](./docs/specs/security-layer.md)
- [Router Agent](./docs/specs/router-agent.md)
- [LLM Provider Layer](./docs/specs/llm-provider-layer.md)
- [MCP Tools](./docs/specs/mcp-tools.md)
- [Agentic Patterns](./docs/specs/README.md)

## Roadmap

### Phase 1: Foundation ✅
- [x] Security Layer with permission system
- [x] Basic Router Agent
- [x] LLM Provider Layer (Anthropic)
- [x] Core MCP Tools (Shell, Context)
- [x] CLI interface

### Phase 2: Core Patterns ✅
- [x] Reflection Pattern implementation with quality scoring
- [x] Enhanced Tool Use with AI SDK v5 function calling
- [x] Planning Pattern with task decomposition
- [x] Web Search tool (Tavily integration)
- [x] Enhanced CLI v2 with pattern visualization
- [ ] RAG tool with vector database
- [ ] Streaming responses in UI

### Phase 3: Advanced Features
- [ ] ReAct Pattern (Reasoning + Acting loops)
- [ ] Multi-Agent Pattern
- [ ] Advanced agent communication
- [ ] Permission analytics
- [ ] Vue 3/Ink terminal UI

### Phase 4: Production Ready
- [ ] Performance optimization & caching
- [ ] Cost tracking and optimization
- [ ] Advanced monitoring
- [ ] Comprehensive test suite
- [ ] Production deployment guides

## Contributing

Contributions are welcome! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Acknowledgments

Duker is inspired by:
- [Anthropic's Agentic Patterns](https://www.anthropic.com/research)
- [Claude Code](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
- [Vercel AI SDK](https://ai-sdk.dev/)
- Industry-proven agentic design patterns

---

**Built with ❤️ by DukeCode**

For more information, see [CLAUDE.md](./CLAUDE.md) for architectural details.
