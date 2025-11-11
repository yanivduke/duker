# Local LLM Features - New in v0.4.0

## 🆕 What's New

Duker now supports **local LLMs via Ollama** with optimized iteration strategies for small models!

### Key Features

#### 1. **Ollama Provider** 🏠
- Run models locally with complete privacy
- Support for CodeLlama, DeepSeek Coder, Qwen, Mistral, and more
- No API costs - completely free
- Works offline

#### 2. **Enhanced MCP Tools** 🛠️
- **Code Analysis Tool**: Deep code understanding (structure, complexity, patterns)
- **Git Operations Tool**: Repository insights (status, diff, history, blame)
- **RAG Tool**: Vector database for semantic search (ChromaDB)
- **Context Tool**: Advanced file operations
- **Shell Tool**: Secure command execution
- **Web Search Tool**: Internet research capability

#### 3. **RAG Knowledge Base** 📚
- Vue3/Vuetify3 comprehensive guide
- TypeScript best practices
- General coding patterns
- Custom knowledge loading
- Semantic search for context retrieval

#### 4. **Model-Specific Optimization** ⚡
- Iteration strategies tuned per model size
- Small models (7B): More iterations, simpler prompts
- Large models (34B): Fewer iterations, complex reasoning
- Temperature optimization by task type
- Dynamic quality thresholds

#### 5. **ReAct Agent for Local LLMs** 🤖
- Simple, structured prompts
- Think-Act-Observe loop
- Knowledge-augmented reasoning
- Tool integration
- Iterative refinement

#### 6. **Iteration-Based Refinement** 🔄
- Prefer cycles over model capability
- Multiple refinement passes
- Quality improvement tracking
- Automatic stall detection
- Smart stopping conditions

## Quick Start with Local LLMs

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows - download from ollama.com
```

### 2. Start Ollama

```bash
ollama serve
```

### 3. Pull a Model

```bash
# Recommended for Vue3/Vuetify3 development
ollama pull codellama:13b

# Or start with a smaller model
ollama pull codellama:7b
```

### 4. Install ChromaDB (Optional)

```bash
pip install chromadb
chroma run --host localhost --port 8000
```

### 5. Configure Duker

```bash
cp .env.example .env
```

Edit `.env`:
```env
DUKER_PREFER_LOCAL=true
DUKER_DEFAULT_PROVIDER=ollama
DUKER_DEFAULT_MODEL=codellama:13b
DUKER_USE_RAG=true
```

### 6. Load Knowledge Base

```bash
npm run load-knowledge
```

### 7. Start Coding!

```bash
npm run dev chat
```

## Usage Examples

### Generate Vue3 Component

```bash
duker "Create a Vue3 user profile card with Vuetify3 components and TypeScript"
```

**What happens:**
1. Router analyzes task → selects local model
2. Loads Vue3/Vuetify3 knowledge from RAG
3. ReAct agent thinks, acts, observes in cycles
4. Code analysis tool validates structure
5. Reflection agent refines quality
6. Returns production-ready component

### Debug with Context

```bash
duker "Debug the LoginForm.vue - email validation not working"
```

**What happens:**
1. Reads file using Context tool
2. Analyzes code structure
3. Searches knowledge base for validation patterns
4. Identifies issue
5. Suggests fix with explanation
6. Optionally applies fix

### Refactor to Best Practices

```bash
duker "Refactor UserList.vue to use Composition API and Pinia"
```

**What happens:**
1. Git tool checks current implementation
2. Code analysis tool understands structure
3. Loads Vue3 Composition API patterns
4. Generates refactored code
5. Multiple reflection cycles ensure quality
6. Produces migration guide

## Model Comparison

| Model | Size | Speed | Quality | Best For | Iterations |
|-------|------|-------|---------|----------|-----------|
| codellama:7b | 7B | ⚡⚡⚡ | ⭐⭐⭐ | Simple tasks | 7 |
| codellama:13b | 13B | ⚡⚡ | ⭐⭐⭐⭐ | Most tasks | 5 |
| deepseek-coder:6.7b | 6.7B | ⚡⚡⚡ | ⭐⭐⭐⭐ | Code-specific | 6 |
| qwen2.5-coder:7b | 7B | ⚡⚡⚡ | ⭐⭐⭐⭐ | Multilingual | 6 |
| phind-codellama:34b | 34B | ⚡ | ⭐⭐⭐⭐⭐ | Complex tasks | 3 |
| mistral:7b | 7B | ⚡⚡⚡ | ⭐⭐⭐ | General | 5 |

## Performance Tips

### Hardware Optimization

**8GB RAM**: Use 7B models
```env
DUKER_DEFAULT_MODEL=codellama:7b
DUKER_PARALLEL_TASKS=1
```

**16GB RAM**: Use 13B models
```env
DUKER_DEFAULT_MODEL=codellama:13b
DUKER_PARALLEL_TASKS=2
```

**32GB+ RAM**: Use 34B models
```env
DUKER_DEFAULT_MODEL=phind-codellama:34b
DUKER_PARALLEL_TASKS=4
```

### Task-Specific Settings

**Code Generation**:
```env
TEMP_CODE_GENERATION=0.2
DUKER_MAX_ITERATIONS=5
```

**Debugging**:
```env
TEMP_DEBUGGING=0.1
DUKER_MAX_ITERATIONS=7
```

**Refactoring**:
```env
TEMP_REFACTORING=0.15
DUKER_QUALITY_THRESHOLD=0.85
```

## Architecture

### Iteration Flow

```
User Input
    ↓
Router Agent (analyzes task)
    ↓
Model Selection (local vs cloud)
    ↓
Knowledge Retrieval (RAG if enabled)
    ↓
ReAct Agent Loop:
  1. THINK: Reason about next step
  2. ACT: Use tools or generate code
  3. OBSERVE: Analyze results
  4. REFLECT: Check quality
  5. Repeat until complete or max iterations
    ↓
Final Response
```

### Tool Integration

```
ReAct Agent
    ↓
MCP Tools:
  - Code Analysis (structure, complexity)
  - Git Operations (history, diff)
  - Context (file operations)
  - Shell (commands)
  - Web Search (research)
  - RAG (knowledge retrieval)
    ↓
Results combined and analyzed
```

## Advanced Configuration

### Custom Model Strategy

```typescript
// src/config/model-config.ts
export const MY_STRATEGY: ModelStrategy = {
  provider: 'ollama',
  model: 'codellama:13b',
  maxIterations: 6,
  temperature: 0.2,
  useKnowledge: true,
  qualityThreshold: 0.85,
}
```

### Custom Knowledge Base

```bash
# Create knowledge file
echo "Your custom patterns..." > knowledge/my-patterns.md

# Load it
npm run load-knowledge
```

### Fine-tune Iterations

```typescript
// src/core/iteration-manager.ts
const config = {
  maxIterations: 8,
  stallThreshold: 4,
  minProgress: 0.05,
}
```

## Migration Guide

### From Cloud-Only to Hybrid

1. Install Ollama and ChromaDB
2. Update `.env` with local settings
3. Keep cloud API keys as fallback
4. Test with local models
5. Use cloud for complex tasks only

### Cost Savings

| Usage | Cloud Cost/Month | Local Cost | Savings |
|-------|-----------------|------------|---------|
| 100 tasks | $20-50 | $0 | 100% |
| 500 tasks | $100-250 | $0 | 100% |
| 1000 tasks | $200-500 | $0 | 100% |

*One-time hardware investment may be needed for optimal performance*

## Troubleshooting

See [LOCAL_LLM_SETUP.md](./LOCAL_LLM_SETUP.md) for detailed troubleshooting.

Quick fixes:
- **Slow**: Use smaller model or enable GPU
- **Poor quality**: Increase iterations or use larger model
- **Out of memory**: Reduce parallel tasks
- **ChromaDB error**: Start ChromaDB server
- **Ollama error**: Check if Ollama is running

## What's Next

- [x] Ollama provider
- [x] Enhanced MCP tools
- [x] RAG knowledge base
- [x] Model-specific configs
- [x] ReAct agent for local LLMs
- [ ] Fine-tuning local models
- [ ] Custom model training
- [ ] Prompt optimization UI
- [ ] Performance benchmarking
- [ ] Multi-model ensemble

## Resources

- [Local LLM Setup Guide](./LOCAL_LLM_SETUP.md)
- [Vue3/Vuetify3 Knowledge](../knowledge/vue3-vuetify3-guide.md)
- [Model Configurations](../src/config/model-config.ts)
- [Ollama Documentation](https://ollama.com/docs)
- [ChromaDB Documentation](https://docs.trychroma.com)
