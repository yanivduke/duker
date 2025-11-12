# Local LLM Setup Guide

This guide explains how to set up and use Duker with local LLMs via Ollama for privacy, cost-effectiveness, and offline development.

## Why Local LLMs?

- **Privacy**: Your code stays on your machine
- **Cost**: No API fees
- **Speed**: Lower latency for small models
- **Offline**: Work without internet
- **Learning**: Understand LLM capabilities

## Prerequisites

1. **Hardware Requirements**
   - Minimum: 8GB RAM (for 7B models)
   - Recommended: 16GB RAM (for 13B models)
   - Optimal: 32GB RAM (for 34B models)
   - GPU: Optional but recommended (NVIDIA with CUDA)

2. **Software Requirements**
   - Node.js 18+
   - Ollama
   - ChromaDB (for RAG knowledge base)

## Installation

### Step 1: Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from [ollama.com/download](https://ollama.com/download)

### Step 2: Start Ollama Server

```bash
ollama serve
```

The server runs on `http://localhost:11434` by default.

### Step 3: Pull Recommended Models

For code generation tasks, we recommend:

**Best for Vue3/Vuetify3 Development:**
```bash
# Small, fast (7B parameters)
ollama pull codellama:7b

# Balanced (13B parameters) - RECOMMENDED
ollama pull codellama:13b

# Specialized code model
ollama pull deepseek-coder:6.7b

# Advanced coding (7B parameters)
ollama pull qwen2.5-coder:7b

# Large, most capable (34B parameters)
ollama pull phind-codellama:34b
```

**General Purpose:**
```bash
# General tasks
ollama pull mistral:7b
```

### Step 4: Install ChromaDB (Optional but Recommended)

ChromaDB provides RAG capabilities for knowledge retrieval.

```bash
# Using pip
pip install chromadb

# Or using Docker
docker pull chromadb/chroma
docker run -p 8000:8000 chromadb/chroma
```

**Start ChromaDB:**
```bash
# If installed via pip
chroma run --host localhost --port 8000

# Or using Docker
docker run -p 8000:8000 chromadb/chroma
```

### Step 5: Configure Duker

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Use local Ollama
DUKER_PREFER_LOCAL=true
DUKER_DEFAULT_PROVIDER=ollama
DUKER_DEFAULT_MODEL=codellama:13b

# Ollama server
OLLAMA_BASE_URL=http://localhost:11434

# ChromaDB for RAG
CHROMA_HOST=localhost
CHROMA_PORT=8000
DUKER_USE_RAG=true

# Iteration settings for local models
DUKER_MAX_ITERATIONS=5
DUKER_QUALITY_THRESHOLD=0.80
```

### Step 6: Load Knowledge Base

Load Vue3/Vuetify3 knowledge into the RAG system:

```bash
npm run load-knowledge
```

This creates collections:
- `duker-vue3-vuetify3` - Vue 3 and Vuetify 3 patterns
- `duker-typescript` - TypeScript best practices
- `duker-best-practices` - General coding practices

### Step 7: Install Dependencies

```bash
npm install
```

### Step 8: Test Setup

```bash
npm run dev -- "Create a Vue3 component with Vuetify3 button"
```

## Model Selection Guide

### For Simple Tasks (Forms, Components, Basic Logic)

**codellama:7b** or **mistral:7b**
- Fast responses (1-3 seconds)
- Low memory usage (4-6GB)
- Quality: Good for straightforward tasks
- Iterations: 7 cycles recommended

### For Moderate Tasks (Full Components, API Integration)

**codellama:13b** (RECOMMENDED) or **qwen2.5-coder:7b**
- Balanced speed and quality (3-5 seconds)
- Memory usage (8-12GB)
- Quality: Very good for most coding tasks
- Iterations: 5 cycles recommended

### For Complex Tasks (Architecture, Refactoring, Complex Logic)

**phind-codellama:34b** or **deepseek-coder:6.7b**
- Slower but higher quality (10-15 seconds)
- Memory usage (16-24GB)
- Quality: Excellent for complex reasoning
- Iterations: 3 cycles recommended

## Optimization Strategies

### 1. Iteration-Based Refinement

Local models benefit from multiple iterations:

```typescript
// Small model with more iterations
{
  model: 'codellama:7b',
  maxIterations: 7,
  reflectionCycles: 2
}

// Large model with fewer iterations
{
  model: 'phind-codellama:34b',
  maxIterations: 3,
  reflectionCycles: 1
}
```

### 2. Use RAG Knowledge Base

Enable knowledge retrieval for better context:

```env
DUKER_USE_RAG=true
DUKER_KNOWLEDGE_COLLECTIONS=duker-vue3-vuetify3,duker-best-practices
```

### 3. Task-Specific Temperature

```env
TEMP_CODE_GENERATION=0.2  # Low for consistency
TEMP_DEBUGGING=0.1        # Very low for precision
TEMP_REFACTORING=0.15     # Low for safety
TEMP_ANALYSIS=0.3         # Higher for creativity
```

### 4. Structured Prompts

The ReAct agent uses simple, structured prompts:

```
Task: [your task]

Knowledge: [relevant context from RAG]

Previous Steps: [what's been done]

Available Tools: [MCP tools]

Response format:
THOUGHT: [reasoning]
ACTION: [tool or COMPLETE]
INPUT: [parameters or answer]
```

## Usage Examples

### Generate Vue3 Component

```bash
duker "Create a Vue3 user profile component with Vuetify3 card, avatar, and edit button"
```

**Expected Iterations:**
1. Analyze requirements
2. Generate basic structure
3. Add Vuetify3 components
4. Refine with TypeScript types
5. Add validation and events

### Debug Existing Code

```bash
duker "Debug the UserForm.vue component - validation not working"
```

**Model Strategy:**
- Uses `deepseek-coder:6.7b` for debugging
- Temperature: 0.1 (precise)
- Iterations: 6
- Tools: code-analysis, file read

### Refactor for Best Practices

```bash
duker "Refactor Dashboard.vue to use composition API and Pinia store"
```

**Model Strategy:**
- Uses `codellama:13b` for refactoring
- Temperature: 0.15
- Reflection cycles: 2
- Quality threshold: 0.85

## Performance Tuning

### GPU Acceleration (NVIDIA)

If you have an NVIDIA GPU:

```bash
# Check CUDA availability
nvidia-smi

# Ollama will automatically use GPU
ollama pull codellama:13b
```

### Memory Management

Monitor memory usage:

```bash
# Check Ollama memory
ollama list

# Stop unused models
ollama stop codellama:7b
```

### Concurrent Requests

Limit parallel tasks based on your hardware:

```env
# For 8GB RAM
DUKER_PARALLEL_TASKS=1

# For 16GB RAM
DUKER_PARALLEL_TASKS=2

# For 32GB+ RAM
DUKER_PARALLEL_TASKS=4
```

## Troubleshooting

### Ollama Connection Failed

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
pkill ollama
ollama serve
```

### ChromaDB Not Available

```bash
# Check ChromaDB
curl http://localhost:8000/api/v1/heartbeat

# Restart ChromaDB
chroma run --host localhost --port 8000
```

### Model Too Slow

1. Use a smaller model (7B instead of 13B)
2. Reduce max iterations
3. Lower max tokens
4. Enable GPU acceleration

### Poor Quality Results

1. Use a larger model (13B or 34B)
2. Increase iterations
3. Enable RAG knowledge base
4. Lower temperature for code generation

### Out of Memory

1. Use smaller model
2. Reduce parallel tasks to 1
3. Lower max tokens
4. Close other applications

## Advanced Configuration

### Custom Model Strategy

Create custom strategies in `src/config/model-config.ts`:

```typescript
export const MY_CUSTOM_STRATEGY: ModelStrategy = {
  provider: 'ollama',
  model: 'codellama:13b',
  maxIterations: 6,
  temperature: 0.2,
  // ... other settings
}
```

### Add Custom Knowledge

Add your own knowledge to RAG:

```bash
# Create knowledge file
echo "Your custom Vue3 patterns..." > knowledge/my-patterns.md

# Load into ChromaDB
duker load-knowledge --collection my-patterns --file knowledge/my-patterns.md
```

### Fine-tune Iteration Logic

Modify iteration manager in `src/core/iteration-manager.ts` for custom stopping conditions.

## Comparison: Local vs Cloud

| Aspect | Local (Ollama) | Cloud (Claude/GPT) |
|--------|---------------|-------------------|
| Privacy | ✅ Complete | ❌ Shared with provider |
| Cost | ✅ Free | ❌ Pay per token |
| Speed (7B) | ✅ 1-3s | ⚠️ 2-5s |
| Speed (34B) | ⚠️ 10-15s | ✅ 2-5s |
| Quality (simple) | ✅ Good | ✅✅ Excellent |
| Quality (complex) | ⚠️ Good with iterations | ✅✅ Excellent |
| Offline | ✅ Yes | ❌ No |
| Setup | ⚠️ Requires setup | ✅ Just API key |

## Best Practices

1. **Start Small**: Begin with `codellama:7b` to test your setup
2. **Upgrade Gradually**: Move to `codellama:13b` once comfortable
3. **Use RAG**: Always enable knowledge base for better results
4. **Monitor Resources**: Keep an eye on RAM and CPU usage
5. **Iterate**: Use multiple cycles for small models
6. **Task Matching**: Use appropriate model size for task complexity
7. **Batch Work**: Group similar tasks together
8. **Cache Results**: Reuse successful patterns
9. **Fallback**: Keep cloud API keys for complex tasks
10. **Experiment**: Test different models for your use cases

## Next Steps

- Read [Vue3/Vuetify3 Guide](../knowledge/vue3-vuetify3-guide.md)
- Explore [Model Configurations](../src/config/model-config.ts)
- Try [ReAct Agent](../src/agents/react-agent-local.ts)
- Check [MCP Tools](../src/mcp/)

## Support

For issues:
- Ollama: [github.com/ollama/ollama](https://github.com/ollama/ollama)
- ChromaDB: [docs.trychroma.com](https://docs.trychroma.com)
- Duker: [github.com/duker/issues](https://github.com/duker/issues)
