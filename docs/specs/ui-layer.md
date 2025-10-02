# UI Layer Specification

## Overview

Duker's UI layer provides an interactive terminal interface built with Vue 3 and Ink, offering real-time feedback, streaming responses, and rich visualizations for the agentic coding assistant.

## Technology Stack

- **Vue 3**: Reactive component framework
- **Ink**: React/Vue components for terminal interfaces
- **Chalk**: Terminal string styling
- **Ora**: Terminal spinners
- **Boxen**: Terminal boxes
- **CLI Spinners**: Loading indicators

## Architecture

```typescript
interface UILayer {
  renderer: TerminalRenderer
  components: ComponentRegistry
  state: UIState
  events: EventEmitter
}

interface TerminalRenderer {
  render(component: VueComponent): void
  update(state: UIState): void
  clear(): void
  exit(): void
}
```

## Core Components

### App Component

```vue
<!-- src/ui/App.vue -->
<template>
  <Box :flex-direction="'column'" :padding="1">
    <Header :title="'Duker AI Coder'" />

    <Box v-if="state.mode === 'input'" :margin-top="1">
      <Input
        :value="userInput"
        :placeholder="'What would you like to code?'"
        @submit="handleInput"
      />
    </Box>

    <Box v-if="state.mode === 'processing'" :margin-top="1">
      <ProcessingView
        :agent="currentAgent"
        :status="processingStatus"
        :progress="progress"
      />
    </Box>

    <Box v-if="state.mode === 'streaming'" :margin-top="1">
      <StreamingResponse :content="streamContent" />
    </Box>

    <Box v-if="state.mode === 'result'" :margin-top="1">
      <ResultView :result="result" />
    </Box>

    <Box v-if="state.mode === 'permission'" :margin-top="1">
      <PermissionDialog
        :request="permissionRequest"
        @decision="handlePermissionDecision"
      />
    </Box>

    <Box v-if="error" :margin-top="1">
      <ErrorDisplay :error="error" />
    </Box>

    <Footer
      :tokens-used="tokensUsed"
      :cost="estimatedCost"
      :duration="duration"
    />
  </Box>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Box, Text } from 'ink'

const state = ref({
  mode: 'input' as 'input' | 'processing' | 'streaming' | 'result' | 'permission'
})

const userInput = ref('')
const currentAgent = ref<string>()
const processingStatus = ref<string>()
const streamContent = ref<string>('')
const result = ref<any>()
const error = ref<Error>()

const handleInput = async (input: string) => {
  state.value.mode = 'processing'
  userInput.value = input

  // Process with agents
  await processInput(input)
}
</script>
```

### Input Component

```vue
<!-- src/ui/components/Input.vue -->
<template>
  <Box>
    <Text :color="'cyan'" :bold="true">→ </Text>
    <TextInput
      :value="value"
      :placeholder="placeholder"
      @change="handleChange"
      @submit="handleSubmit"
    />
  </Box>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Box, Text, TextInput } from 'ink'

const props = defineProps<{
  value: string
  placeholder: string
}>()

const emit = defineEmits<{
  submit: [value: string]
  change: [value: string]
}>()

const handleChange = (value: string) => {
  emit('change', value)
}

const handleSubmit = (value: string) => {
  emit('submit', value)
}
</script>
```

### Processing View Component

```vue
<!-- src/ui/components/ProcessingView.vue -->
<template>
  <Box :flex-direction="'column'">
    <Box :margin-bottom="1">
      <Spinner :type="'dots'" />
      <Text :margin-left="1">
        {{ status }}
      </Text>
    </Box>

    <Box v-if="agent">
      <Text :color="'dim'">
        Agent: <Text :color="'yellow'">{{ agent }}</Text>
      </Text>
    </Box>

    <Box v-if="progress !== undefined" :margin-top="1">
      <ProgressBar
        :value="progress"
        :max="100"
        :width="50"
      />
    </Box>

    <Box v-if="steps.length > 0" :margin-top="1" :flex-direction="'column'">
      <Text :color="'dim'">Steps:</Text>
      <Box
        v-for="(step, i) in steps"
        :key="i"
        :margin-left="2"
      >
        <Text :color="step.status === 'completed' ? 'green' : 'yellow'">
          {{ step.status === 'completed' ? '✓' : '○' }}
        </Text>
        <Text :margin-left="1">{{ step.description }}</Text>
      </Box>
    </Box>
  </Box>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Box, Text } from 'ink'
import Spinner from './Spinner.vue'
import ProgressBar from './ProgressBar.vue'

const props = defineProps<{
  agent?: string
  status: string
  progress?: number
  steps?: Array<{
    description: string
    status: 'pending' | 'active' | 'completed'
  }>
}>()
</script>
```

### Streaming Response Component

```vue
<!-- src/ui/components/StreamingResponse.vue -->
<template>
  <Box :flex-direction="'column'" :border-style="'round'" :padding="1">
    <Text :color="'green'" :bold="true">Response:</Text>

    <Box :margin-top="1">
      <Markdown :content="content" />
    </Box>

    <Box v-if="!complete" :margin-top="1">
      <Spinner :type="'dots'" />
      <Text :margin-left="1" :color="'dim'">Streaming...</Text>
    </Box>
  </Box>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Box, Text } from 'ink'
import Markdown from './Markdown.vue'
import Spinner from './Spinner.vue'

const props = defineProps<{
  content: string
  complete?: boolean
}>()
</script>
```

### Result View Component

```vue
<!-- src/ui/components/ResultView.vue -->
<template>
  <Box :flex-direction="'column'">
    <!-- Code Output -->
    <Box v-if="result.code" :margin-bottom="1">
      <CodeBlock
        :code="result.code"
        :language="result.language"
        :show-line-numbers="true"
      />
    </Box>

    <!-- File Changes -->
    <Box v-if="result.files?.length" :margin-bottom="1">
      <FileChanges :files="result.files" />
    </Box>

    <!-- Command Output -->
    <Box v-if="result.commandOutput">
      <CommandOutput :output="result.commandOutput" />
    </Box>

    <!-- Summary -->
    <Box :margin-top="1" :border-style="'round'" :padding="1">
      <Text>{{ result.summary }}</Text>
    </Box>

    <!-- Actions -->
    <Box :margin-top="1">
      <SelectInput
        :items="actions"
        @select="handleAction"
      />
    </Box>
  </Box>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Box, Text, SelectInput } from 'ink'
import CodeBlock from './CodeBlock.vue'
import FileChanges from './FileChanges.vue'
import CommandOutput from './CommandOutput.vue'

const props = defineProps<{
  result: {
    code?: string
    language?: string
    files?: FileChange[]
    commandOutput?: string
    summary: string
  }
}>()

const actions = [
  { label: 'Accept', value: 'accept' },
  { label: 'Modify', value: 'modify' },
  { label: 'Reject', value: 'reject' },
  { label: 'Ask Question', value: 'question' }
]

const handleAction = (item: { value: string }) => {
  // Handle user action
}
</script>
```

### Code Block Component

```vue
<!-- src/ui/components/CodeBlock.vue -->
<template>
  <Box :flex-direction="'column'" :border-style="'round'" :padding="1">
    <Box :margin-bottom="1">
      <Text :color="'cyan'" :bold="true">{{ language }}</Text>
    </Box>

    <Box :flex-direction="'column'">
      <Box
        v-for="(line, i) in lines"
        :key="i"
      >
        <Text v-if="showLineNumbers" :color="'dim'" :width="4">
          {{ String(i + 1).padStart(3, ' ') }}
        </Text>
        <Text :color="'dim'">│</Text>
        <Text :margin-left="1">
          <HighlightedCode :code="line" :language="language" />
        </Text>
      </Box>
    </Box>
  </Box>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text } from 'ink'
import HighlightedCode from './HighlightedCode.vue'

const props = defineProps<{
  code: string
  language: string
  showLineNumbers?: boolean
}>()

const lines = computed(() => props.code.split('\n'))
</script>
```

### Agent Status Component

```vue
<!-- src/ui/components/AgentStatus.vue -->
<template>
  <Box :flex-direction="'column'" :border-style="'single'" :padding="1">
    <Text :color="'yellow'" :bold="true">Active Agents</Text>

    <Box
      v-for="agent in agents"
      :key="agent.id"
      :margin-top="1"
    >
      <Box :width="20">
        <Text :color="'cyan'">{{ agent.name }}</Text>
      </Box>

      <Box :width="15">
        <StatusBadge :status="agent.status" />
      </Box>

      <Box>
        <Text :color="'dim'">{{ agent.currentTask }}</Text>
      </Box>
    </Box>
  </Box>
</template>

<script setup lang="ts">
import { Box, Text } from 'ink'
import StatusBadge from './StatusBadge.vue'

defineProps<{
  agents: Array<{
    id: string
    name: string
    status: 'idle' | 'active' | 'waiting'
    currentTask?: string
  }>
}>()
</script>
```

## State Management

### Composable for UI State

```typescript
// src/ui/composables/useUIState.ts
import { reactive, computed } from 'vue'

interface UIState {
  mode: 'input' | 'processing' | 'streaming' | 'result' | 'error'
  input: string
  currentAgent?: string
  processingStatus?: string
  streamContent: string
  result?: any
  error?: Error
  metrics: {
    tokensUsed: number
    cost: number
    duration: number
  }
}

const state = reactive<UIState>({
  mode: 'input',
  input: '',
  streamContent: '',
  metrics: {
    tokensUsed: 0,
    cost: 0,
    duration: 0
  }
})

export function useUIState() {
  const setMode = (mode: UIState['mode']) => {
    state.mode = mode
  }

  const setInput = (input: string) => {
    state.input = input
  }

  const setAgent = (agent: string) => {
    state.currentAgent = agent
  }

  const setStatus = (status: string) => {
    state.processingStatus = status
  }

  const appendStream = (chunk: string) => {
    state.streamContent += chunk
  }

  const setResult = (result: any) => {
    state.result = result
    state.mode = 'result'
  }

  const setError = (error: Error) => {
    state.error = error
    state.mode = 'error'
  }

  const updateMetrics = (metrics: Partial<UIState['metrics']>) => {
    Object.assign(state.metrics, metrics)
  }

  const reset = () => {
    state.mode = 'input'
    state.input = ''
    state.currentAgent = undefined
    state.processingStatus = undefined
    state.streamContent = ''
    state.result = undefined
    state.error = undefined
  }

  return {
    state: readonly(state),
    setMode,
    setInput,
    setAgent,
    setStatus,
    appendStream,
    setResult,
    setError,
    updateMetrics,
    reset
  }
}
```

## Terminal Rendering

### Ink-Vue Integration

```typescript
// src/ui/renderer.ts
import { createApp } from 'vue'
import { render } from 'ink-vue'
import App from './App.vue'

export class TerminalRenderer {
  private app: any

  start() {
    this.app = createApp(App)

    render(this.app)
  }

  stop() {
    this.app.unmount()
  }

  async waitForExit(): Promise<void> {
    return new Promise((resolve) => {
      this.app.on('exit', resolve)
    })
  }
}
```

## Streaming Integration

```typescript
// src/ui/streaming.ts
export async function streamResponse(
  generator: AsyncIterable<string>,
  onChunk: (chunk: string) => void
): Promise<void> {
  for await (const chunk of generator) {
    onChunk(chunk)

    // Small delay for smooth rendering
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

// Usage
const { appendStream } = useUIState()

await streamResponse(llmStream, (chunk) => {
  appendStream(chunk)
})
```

## Themes & Styling

```typescript
// src/ui/theme.ts
export const theme = {
  colors: {
    primary: 'cyan',
    secondary: 'yellow',
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
    dim: 'gray'
  },

  borders: {
    default: 'round',
    code: 'single',
    error: 'bold'
  },

  spacing: {
    small: 1,
    medium: 2,
    large: 3
  },

  icons: {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
    pending: '○',
    active: '●'
  }
}
```

## Security Integration

### Permission Dialog Component

The PermissionDialog is a critical security component that prompts users for operation approval. See the complete implementation in [Security Layer Specification](./security-layer.md#ui-permission-prompts).

```vue
<!-- src/ui/components/PermissionDialog.vue -->
<template>
  <Box :flex-direction="'column'" :border-style="'bold'" :padding="1">
    <!-- Risk-based header -->
    <Box :margin-bottom="1">
      <Text :color="riskColor" :bold="true">
        {{ riskIcon }} Permission Required
      </Text>
    </Box>

    <!-- Operation details -->
    <Box :flex-direction="'column'" :margin-bottom="1">
      <Text :color="'yellow'" :bold="true">Operation:</Text>
      <Box :margin-left="2" :margin-top="1">
        <Text>{{ request.operation.description }}</Text>
      </Box>
    </Box>

    <!-- Action preview -->
    <Box :flex-direction="'column'" :margin-bottom="1">
      <Text :color="'yellow'" :bold="true">Action:</Text>
      <Box :margin-left="2" :margin-top="1" :border-style="'single'" :padding="1">
        <Text>{{ formatAction(request.operation) }}</Text>
      </Box>
    </Box>

    <!-- Permission options -->
    <Box :flex-direction="'column'" :margin-top="1">
      <Text :color="'cyan'" :bold="true">Choose an option:</Text>
      <Box :margin-top="1">
        <SelectInput :items="options" @select="handleSelection" />
      </Box>
    </Box>
  </Box>
</template>
```

### Permission Options

The dialog presents different options based on risk level:

- **Allow Once**: Execute this specific operation now (all risk levels)
- **Allow for Session**: Allow until Duker exits (MEDIUM+ risk)
- **Allow Always**: Don't ask again for this operation (non-CRITICAL only)
- **Reject**: Do not execute (all risk levels)

### Integration with Permission Manager

```typescript
// src/ui/composables/usePermissions.ts
import { ref } from 'vue'

const permissionRequest = ref<PermissionRequest | null>(null)
const permissionResolver = ref<((decision: PermissionDecision) => void) | null>(null)

export function usePermissions() {
  const requestPermission = (request: PermissionRequest): Promise<PermissionDecision> => {
    return new Promise((resolve) => {
      permissionRequest.value = request
      permissionResolver.value = resolve
      state.mode = 'permission'
    })
  }

  const handlePermissionDecision = (decision: PermissionDecision) => {
    if (permissionResolver.value) {
      permissionResolver.value(decision)
      permissionResolver.value = null
      permissionRequest.value = null
      state.mode = 'processing' // Resume processing
    }
  }

  return {
    permissionRequest,
    requestPermission,
    handlePermissionDecision
  }
}
```

## Interactive Elements

### Multi-Select for Files

```vue
<template>
  <Box :flex-direction="'column'">
    <Text :color="'cyan'">Select files to modify:</Text>

    <Box
      v-for="(file, i) in files"
      :key="i"
      :margin-top="1"
    >
      <Text :color="selected.includes(i) ? 'green' : 'dim'">
        {{ selected.includes(i) ? '☑' : '☐' }}
      </Text>
      <Text :margin-left="1">{{ file }}</Text>
    </Box>

    <Box :margin-top="1">
      <Text :color="'dim'">
        Press Space to select, Enter to confirm
      </Text>
    </Box>
  </Box>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useInput } from 'ink'

const props = defineProps<{
  files: string[]
}>()

const selected = ref<number[]>([])
const cursor = ref(0)

useInput((input, key) => {
  if (key.upArrow) {
    cursor.value = Math.max(0, cursor.value - 1)
  } else if (key.downArrow) {
    cursor.value = Math.min(props.files.length - 1, cursor.value + 1)
  } else if (input === ' ') {
    toggleSelection(cursor.value)
  } else if (key.return) {
    emit('submit', selected.value.map(i => props.files[i]))
  }
})

const toggleSelection = (index: number) => {
  const idx = selected.value.indexOf(index)
  if (idx > -1) {
    selected.value.splice(idx, 1)
  } else {
    selected.value.push(index)
  }
}
</script>
```

## Keyboard Shortcuts

```typescript
// src/ui/shortcuts.ts
import { useInput } from 'ink'

export function useShortcuts() {
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      // Exit
      process.exit(0)
    }

    if (key.ctrl && input === 'r') {
      // Retry last request
      retryLastRequest()
    }

    if (key.ctrl && input === 'h') {
      // Show help
      showHelp()
    }

    if (key.escape) {
      // Cancel current operation
      cancelOperation()
    }
  })
}
```

## Progress Indicators

```vue
<!-- src/ui/components/ProgressBar.vue -->
<template>
  <Box>
    <Text :color="'cyan'">[</Text>
    <Text :color="'cyan'">{{ filled }}</Text>
    <Text :color="'dim'">{{ empty }}</Text>
    <Text :color="'cyan'">]</Text>
    <Text :margin-left="1">{{ percentage }}%</Text>
  </Box>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text } from 'ink'

const props = defineProps<{
  value: number
  max: number
  width: number
}>()

const percentage = computed(() =>
  Math.round((props.value / props.max) * 100)
)

const filledWidth = computed(() =>
  Math.round((props.value / props.max) * props.width)
)

const filled = computed(() => '█'.repeat(filledWidth.value))
const empty = computed(() => '░'.repeat(props.width - filledWidth.value))
</script>
```

## Error Display

```vue
<!-- src/ui/components/ErrorDisplay.vue -->
<template>
  <Box
    :flex-direction="'column'"
    :border-style="'bold'"
    :border-color="'red'"
    :padding="1"
  >
    <Text :color="'red'" :bold="true">✗ Error</Text>

    <Box :margin-top="1">
      <Text :color="'red'">{{ error.message }}</Text>
    </Box>

    <Box v-if="error.stack && showStack" :margin-top="1">
      <Text :color="'dim'">{{ error.stack }}</Text>
    </Box>

    <Box :margin-top="1">
      <Text :color="'yellow'">
        Press 'r' to retry, 'q' to quit
      </Text>
    </Box>
  </Box>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Box, Text } from 'ink'

defineProps<{
  error: Error
  showStack?: boolean
}>()
</script>
```

## Accessibility

```typescript
// src/ui/accessibility.ts
export const a11y = {
  // Screen reader announcements
  announce(message: string): void {
    process.stdout.write(`\x1b]1337;Announce=${message}\x07`)
  },

  // High contrast mode
  useHighContrast: process.env.FORCE_HIGH_CONTRAST === 'true',

  // Large text mode
  useLargeText: process.env.LARGE_TEXT === 'true'
}
```

## Best Practices

1. **Responsive Design**: Adapt to terminal size
2. **Streaming Updates**: Show progress in real-time
3. **Keyboard Navigation**: Full keyboard support
4. **Clear Feedback**: Visual feedback for all actions
5. **Error Handling**: User-friendly error messages
6. **Accessibility**: Screen reader support
7. **Performance**: Efficient rendering, avoid flicker
8. **Themes**: Support light/dark themes

## Configuration

```typescript
// config/ui.config.ts
export const uiConfig = {
  theme: 'dark',
  animations: true,
  streaming: {
    chunkDelay: 10,
    showTypingIndicator: true
  },
  display: {
    showLineNumbers: true,
    showTokenCount: true,
    showCost: true,
    maxWidth: 120
  }
}
```
