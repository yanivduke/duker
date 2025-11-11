# Vue 3 and Vuetify 3 Developer Guide

## Vue 3 Core Concepts

### Composition API

The Composition API is the recommended approach in Vue 3 for organizing component logic.

```typescript
import { ref, computed, onMounted } from 'vue'

export default {
  setup() {
    // Reactive state
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    // Methods
    const increment = () => {
      count.value++
    }

    // Lifecycle hooks
    onMounted(() => {
      console.log('Component mounted')
    })

    // Expose to template
    return {
      count,
      doubled,
      increment,
    }
  },
}
```

### Script Setup (Recommended)

The `<script setup>` syntax is the most concise way to use Composition API:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// Reactive state
const count = ref(0)
const doubled = computed(() => count.value * 2)

// Methods
const increment = () => {
  count.value++
}

// Lifecycle hooks
onMounted(() => {
  console.log('Component mounted')
})

// No need to return - everything is automatically exposed
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Doubled: {{ doubled }}</p>
    <button @click="increment">Increment</button>
  </div>
</template>
```

### Reactivity Fundamentals

```typescript
import { ref, reactive, toRefs, computed, watch } from 'vue'

// ref - for primitive values
const count = ref(0)
const message = ref('Hello')

// reactive - for objects
const state = reactive({
  user: {
    name: 'John',
    age: 30,
  },
  items: [],
})

// toRefs - destructure reactive object while keeping reactivity
const { user, items } = toRefs(state)

// computed - derived state
const fullInfo = computed(() => `${state.user.name}, ${state.user.age}`)

// watch - side effects
watch(count, (newVal, oldVal) => {
  console.log(`Count changed from ${oldVal} to ${newVal}`)
})

// watchEffect - automatic dependency tracking
watchEffect(() => {
  console.log(`Count is ${count.value}`)
})
```

### Component Props and Emits

```typescript
<script setup lang="ts">
interface Props {
  title: string
  count?: number
  items: string[]
}

interface Emits {
  (e: 'update', value: number): void
  (e: 'delete', id: string): void
}

// Define props with defaults
const props = withDefaults(defineProps<Props>(), {
  count: 0,
})

// Define emits
const emit = defineEmits<Emits>()

// Use props
console.log(props.title)

// Emit events
const handleUpdate = () => {
  emit('update', props.count + 1)
}
</script>
```

### Composables (Reusable Logic)

```typescript
// composables/useCounter.ts
import { ref, computed } from 'vue'

export function useCounter(initialValue = 0) {
  const count = ref(initialValue)
  const doubled = computed(() => count.value * 2)

  const increment = () => count.value++
  const decrement = () => count.value--
  const reset = () => (count.value = initialValue)

  return {
    count,
    doubled,
    increment,
    decrement,
    reset,
  }
}

// Usage in component
<script setup lang="ts">
import { useCounter } from '@/composables/useCounter'

const { count, doubled, increment, decrement, reset } = useCounter(10)
</script>
```

## Vuetify 3 Components

### App Structure

```vue
<template>
  <v-app>
    <v-app-bar color="primary">
      <v-app-bar-title>My App</v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer">
      <v-list>
        <v-list-item
          v-for="item in items"
          :key="item.title"
          :to="item.route"
        >
          <template v-slot:prepend>
            <v-icon :icon="item.icon"></v-icon>
          </template>
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container>
        <router-view></router-view>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const drawer = ref(true)
const items = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', route: '/' },
  { title: 'Users', icon: 'mdi-account-group', route: '/users' },
  { title: 'Settings', icon: 'mdi-cog', route: '/settings' },
]
</script>
```

### Form Components

```vue
<template>
  <v-form ref="form" v-model="valid" @submit.prevent="onSubmit">
    <v-text-field
      v-model="formData.name"
      label="Name"
      :rules="[rules.required]"
      variant="outlined"
    ></v-text-field>

    <v-text-field
      v-model="formData.email"
      label="Email"
      :rules="[rules.required, rules.email]"
      type="email"
      variant="outlined"
    ></v-text-field>

    <v-select
      v-model="formData.role"
      :items="roles"
      label="Role"
      :rules="[rules.required]"
      variant="outlined"
    ></v-select>

    <v-textarea
      v-model="formData.bio"
      label="Bio"
      variant="outlined"
      rows="3"
    ></v-textarea>

    <v-checkbox
      v-model="formData.terms"
      :rules="[rules.required]"
      label="I agree to terms and conditions"
    ></v-checkbox>

    <v-btn
      type="submit"
      color="primary"
      :disabled="!valid"
      :loading="loading"
    >
      Submit
    </v-btn>
  </v-form>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const form = ref()
const valid = ref(false)
const loading = ref(false)

const formData = reactive({
  name: '',
  email: '',
  role: '',
  bio: '',
  terms: false,
})

const roles = ['Admin', 'User', 'Guest']

const rules = {
  required: (v: any) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email',
}

const onSubmit = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return

  loading.value = true
  // Submit form
  await new Promise((resolve) => setTimeout(resolve, 1000))
  loading.value = false
}
</script>
```

### Data Tables

```vue
<template>
  <v-data-table
    :headers="headers"
    :items="items"
    :search="search"
    :loading="loading"
    :items-per-page="10"
    class="elevation-1"
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Users</v-toolbar-title>
        <v-divider class="mx-4" inset vertical></v-divider>
        <v-text-field
          v-model="search"
          append-icon="mdi-magnify"
          label="Search"
          single-line
          hide-details
        ></v-text-field>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog">
          <v-icon>mdi-plus</v-icon>
          Add User
        </v-btn>
      </v-toolbar>
    </template>

    <template v-slot:item.actions="{ item }">
      <v-icon size="small" class="me-2" @click="editItem(item)">
        mdi-pencil
      </v-icon>
      <v-icon size="small" @click="deleteItem(item)">
        mdi-delete
      </v-icon>
    </template>
  </v-data-table>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const search = ref('')
const loading = ref(false)

const headers = [
  { title: 'Name', key: 'name', align: 'start' },
  { title: 'Email', key: 'email' },
  { title: 'Role', key: 'role' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const items = ref([
  { name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
])

const openDialog = () => {
  // Open add dialog
}

const editItem = (item: any) => {
  // Edit item
}

const deleteItem = (item: any) => {
  // Delete item
}
</script>
```

### Dialogs and Modals

```vue
<template>
  <v-dialog v-model="dialog" max-width="600px">
    <template v-slot:activator="{ props }">
      <v-btn color="primary" v-bind="props">Open Dialog</v-btn>
    </template>

    <v-card>
      <v-card-title>
        <span class="text-h5">{{ title }}</span>
      </v-card-title>

      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="editedItem.name"
                label="Name"
                variant="outlined"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="editedItem.email"
                label="Email"
                type="email"
                variant="outlined"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close">
          Cancel
        </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save">
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const dialog = ref(false)
const title = ref('Add Item')

const editedItem = reactive({
  name: '',
  email: '',
})

const close = () => {
  dialog.value = false
}

const save = () => {
  // Save logic
  close()
}
</script>
```

### Cards and Layouts

```vue
<template>
  <v-container>
    <v-row>
      <v-col v-for="item in items" :key="item.id" cols="12" md="4">
        <v-card>
          <v-img
            :src="item.image"
            height="200px"
            cover
          ></v-img>

          <v-card-title>{{ item.title }}</v-card-title>

          <v-card-subtitle>{{ item.subtitle }}</v-card-subtitle>

          <v-card-text>
            {{ item.description }}
          </v-card-text>

          <v-card-actions>
            <v-btn color="primary" variant="text">
              Learn More
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn icon @click="toggleFavorite(item)">
              <v-icon>{{
                item.favorite ? 'mdi-heart' : 'mdi-heart-outline'
              }}</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
```

### Snackbars and Alerts

```vue
<template>
  <div>
    <v-btn @click="showSnackbar">Show Snackbar</v-btn>
    <v-btn @click="showAlert">Show Alert</v-btn>

    <v-snackbar
      v-model="snackbar"
      :timeout="timeout"
      :color="snackbarColor"
      location="top right"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar = false">Close</v-btn>
      </template>
    </v-snackbar>

    <v-alert
      v-model="alert"
      :type="alertType"
      closable
      variant="tonal"
    >
      {{ alertText }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')
const timeout = ref(3000)

const alert = ref(false)
const alertText = ref('')
const alertType = ref<'success' | 'info' | 'warning' | 'error'>('info')

const showSnackbar = () => {
  snackbarText.value = 'Operation completed successfully!'
  snackbarColor.value = 'success'
  snackbar.value = true
}

const showAlert = () => {
  alertText.value = 'This is an important alert message.'
  alertType.value = 'warning'
  alert.value = true
}
</script>
```

## Best Practices

### 1. Component Organization

```
components/
├── common/           # Reusable components
│   ├── AppButton.vue
│   ├── AppCard.vue
│   └── AppDialog.vue
├── forms/            # Form components
│   ├── UserForm.vue
│   └── LoginForm.vue
└── layout/           # Layout components
    ├── AppHeader.vue
    ├── AppSidebar.vue
    └── AppFooter.vue
```

### 2. TypeScript Integration

```typescript
// types/models.ts
export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user' | 'guest'
}

export interface FormData {
  name: string
  email: string
  password: string
}

// Usage in component
<script setup lang="ts">
import type { User } from '@/types/models'

const users = ref<User[]>([])
const currentUser = ref<User | null>(null)
</script>
```

### 3. Composables for Reusable Logic

```typescript
// composables/useApi.ts
import { ref } from 'vue'

export function useApi<T>(url: string) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const fetch = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(url)
      data.value = await response.json()
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, fetch }
}
```

### 4. State Management with Pinia

```typescript
// stores/user.ts
import { defineStore } from 'pinia'
import type { User } from '@/types/models'

export const useUserStore = defineStore('user', {
  state: () => ({
    currentUser: null as User | null,
    users: [] as User[],
  }),

  getters: {
    isAdmin: (state) => state.currentUser?.role === 'admin',
    userCount: (state) => state.users.length,
  },

  actions: {
    async fetchUsers() {
      const response = await fetch('/api/users')
      this.users = await response.json()
    },

    setCurrentUser(user: User) {
      this.currentUser = user
    },
  },
})

// Usage
<script setup lang="ts">
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
</script>
```

### 5. Performance Optimization

```vue
<script setup lang="ts">
import { ref, computed, shallowRef, markRaw } from 'vue'

// Use shallowRef for large objects that won't change deeply
const largeData = shallowRef([])

// Use markRaw for non-reactive data
const staticData = markRaw({ /* large object */ })

// Lazy load heavy components
const HeavyComponent = defineAsyncComponent(
  () => import('./HeavyComponent.vue')
)

// Virtual scrolling for large lists
import { VVirtualScroll } from 'vuetify/components'
</script>
```

## Common Patterns

### API Integration Pattern

```typescript
// services/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

// Usage
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import type { User } from '@/types/models'

const users = ref<User[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get<User[]>('/users')
    users.value = data
  } catch (error) {
    console.error('Failed to fetch users:', error)
  } finally {
    loading.value = false
  }
})
</script>
```

### Form Validation Pattern

```vue
<script setup lang="ts">
import { ref, reactive, computed } from 'vue'

interface FormData {
  email: string
  password: string
  confirmPassword: string
}

const form = ref()
const formData = reactive<FormData>({
  email: '',
  password: '',
  confirmPassword: '',
})

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email',
  minLength: (min: number) => (v: string) =>
    v.length >= min || `Minimum ${min} characters`,
  passwordMatch: (v: string) =>
    v === formData.password || 'Passwords must match',
}

const isValid = computed(() => {
  return (
    formData.email &&
    formData.password &&
    formData.password === formData.confirmPassword
  )
})

const submit = async () => {
  const { valid } = await form.value.validate()
  if (valid) {
    // Submit logic
  }
}
</script>
```

## Vuetify Theming

```typescript
// plugins/vuetify.ts
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107',
        },
      },
      dark: {
        colors: {
          primary: '#2196F3',
          secondary: '#424242',
          accent: '#FF4081',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
        },
      },
    },
  },
})
```
