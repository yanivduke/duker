# Migration Guide

## Upgrading to v0.2.0 from v0.1.0

### Overview

Version 0.2.0 represents a significant upgrade with the addition of three new agentic patterns and migration to Vercel AI SDK v5. This guide will help you upgrade smoothly.

### Breaking Changes

#### 1. AI SDK Version Upgrade (v3 → v5)

**Impact**: If you've customized or extended the LLM providers

**What Changed**:
- `anthropic()` initialization now requires `createAnthropic({ apiKey })`
- Parameter name changes in `generateText()`:
  - `maxTokens` → `maxOutputTokens`
  - `maxSteps` → `stopWhen: stepCountIs(n)`
- Token usage property names:
  - `promptTokens` → `inputTokens`
  - `completionTokens` → `outputTokens`
- Messages can now use separate `system` and `prompt` parameters

**Migration Example**:

```typescript
// Before (v0.1.0)
import { anthropic } from '@ai-sdk/anthropic'

const model = anthropic('claude-3-5-sonnet-20241022', {
  apiKey: apiKey,
})

const result = await generateText({
  model,
  messages: [...],
  maxTokens: 4096,
  maxSteps: 5,
})

console.log(result.usage.promptTokens)

// After (v0.2.0)
import { createAnthropic } from '@ai-sdk/anthropic'
import { stepCountIs } from 'ai'

const anthropic = createAnthropic({ apiKey })
const model = anthropic('claude-3-5-sonnet-20241022')

const result = await generateText({
  model,
  system: 'System prompt here',
  prompt: 'User prompt here',
  maxOutputTokens: 4096,
  stopWhen: stepCountIs(5),
})

console.log(result.usage.inputTokens)
```

#### 2. CLI Command Changes

**Impact**: Users running Duker

**What Changed**:
- Default CLI now uses enhanced v2 (`npm run dev` → uses cli-v2.ts)
- Original CLI still available via `npm run dev:v1`
- New `npm run dev:v2` for explicit v2 usage

**Migration**:
No action required. The enhanced CLI is backward compatible with all v0.1.0 commands.

#### 3. AgentResponse Metadata

**Impact**: If you're programmatically using agent responses

**What Changed**:
Added optional `finalQuality` field to metadata:

```typescript
interface AgentResponse {
  // ... existing fields
  metadata?: {
    // ... existing fields
    finalQuality?: number  // NEW: Quality score from reflection pattern
  }
}
```

**Migration**:
Existing code continues to work. The field is optional and only present when using the Reflection pattern.

### New Features

#### 1. Reflection Pattern

Iterative self-evaluation and refinement:

```bash
# Will automatically use reflection for moderate-complexity code generation
npm run dev ask "Write a function to parse CSV files"
```

**Configuration** (in code):
```typescript
import { ReflectionAgent } from './agents/reflection-agent.js'

const agent = new ReflectionAgent(llmManager, {
  maxIterations: 3,
  qualityThreshold: 0.85,
})
```

#### 2. Tool Use Pattern (Enhanced)

Now uses AI SDK v5 function calling:

```bash
# Will automatically use tool-use pattern for file operations
npm run dev ask "Read the README.md file and summarize it"
```

**Custom Tool Registration**:
```typescript
import { ToolUseAgent } from './agents/tool-use-agent.js'

const agent = new ToolUseAgent(llmManager, apiKey, {
  maxSteps: 5,
  temperature: 0.7,
})

agent.registerTool(customTool)
```

#### 3. Planning Pattern

Task decomposition and orchestration:

```bash
# Will automatically use planning for complex multi-step tasks
npm run dev ask "Create a new Express API with authentication and database"
```

#### 4. Web Search Tool

Tavily-powered web search:

```bash
# Add to your .env
TAVILY_API_KEY=your_tavily_key_here
```

```bash
# Will use web search when needed
npm run dev ask "What are the latest features in React 19?"
```

#### 5. Enhanced CLI v2

New visualization features:
- Pattern selection display
- Quality scores for reflection
- Iteration counts
- Tool usage tracking
- Improved error messages

### Dependency Updates

Update your `package.json` if you've forked the project:

```json
{
  "dependencies": {
    "ai": "^5.0.59",
    "@ai-sdk/anthropic": "^2.0.23",
    "@ai-sdk/openai": "^2.0.42",
    "@ai-sdk/google": "^2.0.17"
  }
}
```

### Environment Variables

New optional variables:

```bash
# Add to .env for web search functionality
TAVILY_API_KEY=your_tavily_key_here
```

All existing environment variables remain the same.

### Data Migration

No data migration required. Your existing:
- Permission settings (`.duker/permissions.json`)
- Audit logs (`.duker/audit.log`)

...will continue to work without changes.

### Pattern Selection Logic

The Router Agent V2 now automatically selects the best pattern:

| Task Type | Complexity | Pattern Used |
|-----------|-----------|--------------|
| Multi-step, Complex tasks | Complex | **Planning** |
| Tasks requiring tools | Any | **Tool Use** |
| Code generation | Moderate | **Reflection** |
| Simple queries | Simple | **Direct** |

You can observe which pattern was used in the CLI output:

```
Pattern: REFLECTION | 2,450 tokens | 3,240ms
Iterations: 2
Quality: 92.5%
```

### Testing Your Migration

1. **Update dependencies**:
```bash
npm install
```

2. **Run type check**:
```bash
npm run type-check
```

3. **Build the project**:
```bash
npm run build
```

4. **Test basic functionality**:
```bash
npm run dev ask "What is 2+2?"
```

5. **Test new patterns**:
```bash
# Test reflection
npm run dev ask "Write a function to validate email addresses"

# Test tool use
npm run dev ask "List files in the current directory"

# Test planning
npm run dev ask "Create a TODO app with React and Node.js backend"
```

### Rollback Procedure

If you encounter issues, you can rollback to v0.1.0:

```bash
git checkout v0.1.0
npm install
npm run build
```

Or use CLI v1 while staying on v0.2.0:

```bash
npm run dev:v1 chat
```

### Known Issues

1. **Tavily API Key**: Web search requires a Tavily API key. Without it, the tool will return a helpful message but won't perform actual searches.

2. **Token Usage**: The new patterns (especially Reflection and Planning) may use more tokens due to iterative refinement and task decomposition. Monitor your API usage accordingly.

3. **Response Times**: Planning and Reflection patterns take longer than direct execution due to multiple LLM calls. This is expected behavior.

### Getting Help

If you encounter issues during migration:

1. Check the [CHANGELOG.md](../CHANGELOG.md) for detailed changes
2. Review the updated [README.md](../README.md)
3. See [CLAUDE.md](../CLAUDE.md) for architecture details
4. Open an issue on GitHub with:
   - Your migration steps
   - Error messages
   - Environment details (Node version, OS)

### What's Next

After migrating to v0.2.0, you can look forward to:

- **Phase 3**: ReAct pattern, Multi-Agent coordination
- **Phase 4**: Performance optimizations, production readiness

See the [Roadmap](../README.md#roadmap) for details.
