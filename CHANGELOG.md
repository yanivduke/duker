# Changelog

All notable changes to the Duker project will be documented in this file.

## [0.2.0] - 2025-10-02

### Added - Phase 2 Implementation

#### Agentic Patterns
- **Reflection Agent**: Iterative self-evaluation and refinement with quality scoring
  - JSON-based evaluation across 5 quality dimensions (correctness, completeness, clarity, efficiency, best practices)
  - Configurable quality threshold and maximum iterations
  - Detailed issue tracking with severity levels

- **Enhanced Tool Use Agent**: Integration with Vercel AI SDK v5 function calling
  - Automatic MCP tool to AI SDK tool conversion
  - Zod schema generation from tool definitions
  - Multi-step tool execution with `stopWhen` conditions
  - Permission-aware tool execution

- **Planning Agent**: Task decomposition and orchestration
  - Automatic subtask generation with dependency tracking
  - Wave-based parallel execution for independent subtasks
  - LLM-powered task decomposition and synthesis
  - Structured plan JSON parsing with fallback

- **Router Agent V2**: Enhanced intelligent pattern selection
  - Analyzes task complexity, type, and requirements
  - Routes to optimal pattern: Direct, Reflection, Tool Use, or Planning
  - Integrated model selection based on task analysis
  - Metadata tracking for pattern performance

#### Tools
- **Web Search Tool**: Tavily API integration
  - Permission-controlled network operations
  - Specialized methods for code and documentation search
  - Graceful fallback when API key not available

#### UI Improvements
- **CLI V2**: Enhanced terminal interface
  - Ora spinner animations during processing
  - Color-coded pattern visualization
  - Quality score display for reflection pattern
  - Iteration count tracking
  - Tool usage reporting
  - Improved error handling with user cancellation support

### Changed - AI SDK v5 Migration

#### Breaking Changes
- Upgraded from AI SDK v3 to v5
- Updated all AI SDK dependencies:
  - `ai`: ^3.4.33 → ^5.0.59
  - `@ai-sdk/anthropic`: ^0.0.63 → ^2.0.23
  - `@ai-sdk/openai`: ^0.0.68 → ^2.0.42
  - `@ai-sdk/google`: ^0.0.54 → ^2.0.17

#### API Changes
- `anthropic()`: Now uses `createAnthropic({ apiKey })` for initialization
- `generateText()`:
  - `maxTokens` → `maxOutputTokens`
  - `maxSteps` → `stopWhen: stepCountIs(n)`
  - Separate `system` and `prompt` parameters instead of messages array
- Token usage properties:
  - `promptTokens` → `inputTokens`
  - `completionTokens` → `outputTokens`
- Tool calling:
  - Access via `result.toolCalls` instead of `result.steps.flatMap()`
  - Tools defined as objects with `inputSchema` and `execute` methods

### Fixed
- Type safety issues with AI SDK v5 migration
- Token usage undefined handling with null coalescing
- Web search tool JSON response typing
- Model initialization with API keys

### Technical Improvements
- All TypeScript type errors resolved
- Successful build with `tsc --noEmit`
- Enhanced type safety with proper interface definitions
- Added `finalQuality` to `AgentResponse` metadata

## [0.1.0] - 2025-10-01

### Added - Phase 1 Implementation

#### Security Layer
- Permission Manager with 5 risk levels (SAFE, LOW, MEDIUM, HIGH, CRITICAL)
- Permission Store with persistence to `.duker/permissions.json`
- Audit Logger with detailed operation logging
- Risk Assessment for shell commands, file operations, and network requests
- Terminal-based permission prompts with 4 options: Allow Once, Allow for Session, Allow Always, Reject

#### LLM Integration
- LLM Manager with multi-provider support
- Anthropic Claude provider (Sonnet, Opus, Haiku)
- Intelligent model selection based on task analysis
- Retry logic with exponential backoff

#### MCP Tools
- Shell Tool: Secure command execution with permission checks
- Context Tool: File operations (read, write, find) with security
- Tool interface standardization

#### Agents
- Router Agent: Basic task analysis and routing
- Direct pattern execution
- Tool-use pattern support

#### CLI
- Interactive chat mode
- Single question mode
- Terminal-based permission UI
- Color-coded risk level display

#### Documentation
- Comprehensive architecture documentation in `CLAUDE.md`
- Detailed specifications for all layers in `docs/specs/`
- Security layer specification
- Development roadmap

### Infrastructure
- TypeScript configuration with ES modules
- ESLint setup
- Vitest for testing
- Project structure with organized modules
- Environment variable configuration
