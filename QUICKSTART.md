# Duker Quick Start Guide

Get up and running with Duker in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- An Anthropic API key ([get one here](https://console.anthropic.com/))

## Installation

```bash
# 1. Clone or navigate to duker directory
cd duker

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Edit .env and add your API key
# ANTHROPIC_API_KEY=sk-ant-...
```

## Your First Conversation

```bash
npm run dev chat
```

Try asking:
- "What is the difference between let and const in JavaScript?"
- "Write a function to reverse a string"
- "Explain how async/await works"

Type `exit` to quit.

## Pattern Examples

### Direct Pattern (Simple Questions)

```bash
npm run dev ask "What is TypeScript?"
```

**Expected**: Quick, straightforward answer. ~1-2 seconds.

### Reflection Pattern (Code Quality)

```bash
npm run dev ask "Write a production-ready email validation function"
```

**Expected**:
- 2-3 iterations of refinement
- Quality score display (e.g., 92.5%)
- ~5-8 seconds

### Tool Use Pattern (File Operations)

```bash
npm run dev ask "List all TypeScript files in the src directory"
```

**Expected**:
- Permission prompt for shell access
- Actual file listing from your project
- Tool usage report

### Planning Pattern (Complex Tasks)

```bash
npm run dev ask "Create a REST API with authentication and database"
```

**Expected**:
- Task decomposition into subtasks
- Dependency-based execution waves
- Final synthesized response
- ~15-30 seconds

## Permission System

When Duker needs to perform operations, you'll see:

```
⚠ Permission Required

Agent: router-v2
Operation: Execute shell command
Action: ls -la src/
Risk Level: LOW

Options:
  1. Allow once
  2. Allow for session
  3. Allow always
  4. Reject

Choice (1-4):
```

**Recommendations**:
- Use "Allow once" (1) for testing
- Use "Allow for session" (2) for active development
- Use "Reject" (4) if you're unsure

## Understanding the Output

After each response, you'll see metadata:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pattern: REFLECTION | 2,450 tokens | 3,240ms
Iterations: 2
Quality: 92.5%
Tools: shell, context
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- **Pattern**: Which agentic pattern was used
- **Tokens**: API token usage (for cost tracking)
- **Duration**: Response time in milliseconds
- **Iterations**: Number of refinement cycles (Reflection only)
- **Quality**: Self-assessed quality score (Reflection only)
- **Tools**: Which tools were used (if any)

## Pattern Colors

- **DIRECT** (gray): Simple, fast responses
- **REFLECTION** (blue): Iterative quality improvement
- **TOOL-USE** (green): External tool execution
- **PLANNING** (magenta): Complex task orchestration

## Optional: Web Search

For web search capabilities:

1. Get a Tavily API key from [tavily.com](https://tavily.com)
2. Add to `.env`:
   ```
   TAVILY_API_KEY=tvly-...
   ```
3. Restart Duker

Then try:
```bash
npm run dev ask "What are the latest features in React 19?"
```

## Troubleshooting

### "ANTHROPIC_API_KEY not found"
- Check your `.env` file exists
- Verify the key is correctly copied (starts with `sk-ant-`)

### "Permission denied"
- You chose "Reject" or "Allow Always" with reject
- Delete `.duker/permissions.json` to reset

### Type errors on build
```bash
npm install
npm run type-check
```

### Slow responses
- Normal for Planning and Reflection patterns
- Direct pattern is fastest for simple queries

## Next Steps

1. **Explore Patterns**: Try different types of tasks to see pattern selection
2. **Review Logs**: Check `.duker/audit.log` for all operations
3. **Read Docs**: See `README.md` for comprehensive guide
4. **Check Examples**: See `PHASE2_SUMMARY.md` for pattern details

## Common Use Cases

### Code Review
```bash
npm run dev ask "Review this function for security issues: [paste code]"
```

### Debugging
```bash
npm run dev ask "Why am I getting this error: [paste error]"
```

### Architecture
```bash
npm run dev ask "Design a microservices architecture for an e-commerce platform"
```

### Learning
```bash
npm run dev ask "Explain SOLID principles with TypeScript examples"
```

## Safety Tips

- ✅ Start with "Allow once" for all operations
- ✅ Review permissions in `.duker/permissions.json`
- ✅ Check audit log regularly
- ❌ Don't "Allow always" for HIGH/CRITICAL operations
- ❌ Don't run on production systems without testing

## Getting Help

- **Documentation**: `README.md`, `CLAUDE.md`
- **Migration Guide**: `docs/MIGRATION.md`
- **Architecture**: `docs/specs/`
- **Issues**: GitHub issues

## Performance Tips

### To Minimize Token Usage
- Use Direct pattern for simple questions
- Be specific in your requests
- Avoid unnecessary tool use

### To Maximize Quality
- Use Reflection for production code
- Use Planning for complex projects
- Provide clear, detailed requirements

### To Optimize Speed
- Use cached permissions ("Allow for session")
- Ask focused questions
- Use Direct pattern when possible

## Example Session

```bash
$ npm run dev chat

🤖 Duker AI Coding Assistant v2

Enhanced with: Reflection, Tool Use, and Planning patterns
Type your questions or tasks. Type "exit" to quit.

You: Write a TypeScript function to validate email

# Duker thinks... (uses Reflection pattern)
# Shows 2 iterations of refinement
# Final quality: 94.2%

[Output: Well-documented, tested function]

You: List my TypeScript files

# Permission prompt appears
# You choose: Allow once
# Uses Tool Use pattern

[Output: Actual file listing]

You: Create a TODO app architecture

# Uses Planning pattern
# Shows task decomposition
# Provides comprehensive architecture

[Output: Detailed design document]

You: exit

Goodbye! 👋
```

---

**You're ready to go!** 🚀

Try: `npm run dev chat` to start your first conversation.
