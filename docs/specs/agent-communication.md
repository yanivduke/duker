# Agent Communication Protocol Specification

## Overview

The Agent Communication Protocol defines how agents exchange information, coordinate actions, and collaborate in the Duker multi-agent system.

## Communication Architecture

```typescript
interface CommunicationProtocol {
  messageBus: MessageBus
  serialize(message: AgentMessage): string
  deserialize(data: string): AgentMessage
  send(message: AgentMessage): Promise<void>
  receive(agentId: string): Promise<AgentMessage[]>
  broadcast(message: Omit<AgentMessage, 'to'>): Promise<void>
}
```

## Message Structure

### Base Message Format

```typescript
interface AgentMessage {
  id: string
  from: AgentId
  to: AgentId | AgentId[] | '*'  // Single, multiple, or broadcast
  type: MessageType
  payload: any
  timestamp: number
  priority: Priority
  replyTo?: string
  metadata?: MessageMetadata
}

type MessageType =
  | 'request'        // Request information or action
  | 'response'       // Response to request
  | 'proposal'       // Propose solution or approach
  | 'critique'       // Critique/feedback on work
  | 'collaboration'  // Invitation to collaborate
  | 'result'         // Share results
  | 'error'          // Error notification
  | 'status'         // Status update
  | 'query'          // Query for information
  | 'command'        // Command to execute

type Priority = 'critical' | 'high' | 'normal' | 'low'

interface MessageMetadata {
  correlationId?: string
  conversationId?: string
  retryCount?: number
  ttl?: number
  encrypted?: boolean
}
```

### Message Types

#### Request Message

```typescript
interface RequestMessage extends AgentMessage {
  type: 'request'
  payload: {
    action: string
    parameters: Record<string, any>
    expectedResponse?: string
    deadline?: number
  }
}

// Example
const request: RequestMessage = {
  id: 'req-123',
  from: 'router-agent',
  to: 'tool-agent',
  type: 'request',
  payload: {
    action: 'search-web',
    parameters: { query: 'Vue 3 best practices' },
    expectedResponse: 'SearchResult'
  },
  timestamp: Date.now(),
  priority: 'normal'
}
```

#### Response Message

```typescript
interface ResponseMessage extends AgentMessage {
  type: 'response'
  payload: {
    success: boolean
    data: any
    error?: string
  }
  replyTo: string  // ID of original request
}

// Example
const response: ResponseMessage = {
  id: 'res-123',
  from: 'tool-agent',
  to: 'router-agent',
  type: 'response',
  payload: {
    success: true,
    data: { results: [...] }
  },
  replyTo: 'req-123',
  timestamp: Date.now(),
  priority: 'normal'
}
```

#### Proposal Message

```typescript
interface ProposalMessage extends AgentMessage {
  type: 'proposal'
  payload: {
    title: string
    description: string
    approach: string
    estimatedEffort?: number
    pros: string[]
    cons: string[]
    alternatives?: Proposal[]
  }
}
```

#### Critique Message

```typescript
interface CritiqueMessage extends AgentMessage {
  type: 'critique'
  payload: {
    targetId: string  // ID of work being critiqued
    rating: number    // 0-1 quality score
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
    severity: 'minor' | 'major' | 'critical'
  }
}
```

## Message Bus Implementation

### In-Memory Message Bus

```typescript
class InMemoryMessageBus implements MessageBus {
  private queues: Map<string, AgentMessage[]> = new Map()
  private subscribers: Map<string, MessageHandler[]> = new Map()
  private messageHistory: AgentMessage[] = []

  async send(message: AgentMessage): Promise<void> {
    // Store in history
    this.messageHistory.push(message)

    // Route to recipient(s)
    if (message.to === '*') {
      // Broadcast to all
      await this.broadcast(message)
    } else if (Array.isArray(message.to)) {
      // Send to multiple recipients
      for (const recipient of message.to) {
        await this.enqueue(recipient, message)
      }
    } else {
      // Send to single recipient
      await this.enqueue(message.to, message)
    }

    // Notify subscribers
    await this.notifySubscribers(message)
  }

  async receive(agentId: string): Promise<AgentMessage[]> {
    const queue = this.queues.get(agentId) || []
    this.queues.set(agentId, [])  // Clear queue
    return queue
  }

  async broadcast(message: Omit<AgentMessage, 'to'>): Promise<void> {
    const broadcastMsg = { ...message, to: '*' as const }

    for (const [agentId, _] of this.queues) {
      await this.enqueue(agentId, broadcastMsg)
    }
  }

  subscribe(agentId: string, handler: MessageHandler): void {
    const handlers = this.subscribers.get(agentId) || []
    handlers.push(handler)
    this.subscribers.set(agentId, handlers)
  }

  private async enqueue(agentId: string, message: AgentMessage): Promise<void> {
    const queue = this.queues.get(agentId) || []
    queue.push(message)
    this.queues.set(agentId, queue)
  }

  private async notifySubscribers(message: AgentMessage): Promise<void> {
    const recipients = message.to === '*'
      ? Array.from(this.subscribers.keys())
      : Array.isArray(message.to)
      ? message.to
      : [message.to]

    for (const recipient of recipients) {
      const handlers = this.subscribers.get(recipient) || []
      for (const handler of handlers) {
        await handler(message)
      }
    }
  }

  getHistory(filter?: MessageFilter): AgentMessage[] {
    if (!filter) return this.messageHistory

    return this.messageHistory.filter(msg => {
      if (filter.from && msg.from !== filter.from) return false
      if (filter.to && msg.to !== filter.to) return false
      if (filter.type && msg.type !== filter.type) return false
      if (filter.since && msg.timestamp < filter.since) return false
      return true
    })
  }
}
```

### Redis-Based Message Bus (Production)

```typescript
import { Redis } from 'ioredis'

class RedisMessageBus implements MessageBus {
  private redis: Redis
  private pubsub: Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL)
    this.pubsub = new Redis(process.env.REDIS_URL)
  }

  async send(message: AgentMessage): Promise<void> {
    const serialized = JSON.stringify(message)

    if (message.to === '*') {
      // Publish to broadcast channel
      await this.redis.publish('agent:broadcast', serialized)
    } else if (Array.isArray(message.to)) {
      // Push to multiple queues
      for (const recipient of message.to) {
        await this.redis.lpush(`agent:${recipient}:queue`, serialized)
      }
    } else {
      // Push to single queue
      await this.redis.lpush(`agent:${message.to}:queue`, serialized)
    }

    // Store in history with TTL
    await this.redis.setex(
      `message:${message.id}`,
      3600,  // 1 hour TTL
      serialized
    )
  }

  async receive(agentId: string): Promise<AgentMessage[]> {
    const messages = await this.redis.rpop(`agent:${agentId}:queue`, 10)

    if (!messages) return []

    return messages.map(msg => JSON.parse(msg))
  }

  subscribe(agentId: string, handler: MessageHandler): void {
    this.pubsub.subscribe(`agent:${agentId}`, (err) => {
      if (err) console.error('Subscribe error:', err)
    })

    this.pubsub.on('message', async (channel, message) => {
      if (channel === `agent:${agentId}`) {
        await handler(JSON.parse(message))
      }
    })
  }
}
```

## Communication Patterns

### Request-Response Pattern

```typescript
class RequestResponsePattern {
  constructor(private messageBus: MessageBus) {}

  async request(
    from: string,
    to: string,
    action: string,
    params: any,
    timeout: number = 30000
  ): Promise<any> {
    const requestId = `req-${Date.now()}`

    // Send request
    await this.messageBus.send({
      id: requestId,
      from,
      to,
      type: 'request',
      payload: { action, parameters: params },
      timestamp: Date.now(),
      priority: 'normal'
    })

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'))
      }, timeout)

      const checkResponse = async () => {
        const messages = await this.messageBus.receive(from)

        const response = messages.find(
          msg => msg.type === 'response' && msg.replyTo === requestId
        )

        if (response) {
          clearTimeout(timeoutId)

          if (response.payload.success) {
            resolve(response.payload.data)
          } else {
            reject(new Error(response.payload.error))
          }
        } else {
          // Check again in 100ms
          setTimeout(checkResponse, 100)
        }
      }

      checkResponse()
    })
  }
}
```

### Publish-Subscribe Pattern

```typescript
class PubSubPattern {
  constructor(private messageBus: MessageBus) {}

  async publish(topic: string, data: any, from: string): Promise<void> {
    await this.messageBus.broadcast({
      id: `pub-${Date.now()}`,
      from,
      type: 'result',
      payload: { topic, data },
      timestamp: Date.now(),
      priority: 'normal'
    })
  }

  subscribe(agentId: string, topic: string, handler: (data: any) => void): void {
    this.messageBus.subscribe(agentId, async (message) => {
      if (message.type === 'result' && message.payload.topic === topic) {
        await handler(message.payload.data)
      }
    })
  }
}
```

### Collaboration Pattern

```typescript
class CollaborationPattern {
  constructor(private messageBus: MessageBus) {}

  async invite(
    from: string,
    to: string[],
    task: string,
    context: any
  ): Promise<CollaborationSession> {
    const sessionId = `collab-${Date.now()}`

    // Invite all participants
    for (const participant of to) {
      await this.messageBus.send({
        id: `invite-${participant}`,
        from,
        to: participant,
        type: 'collaboration',
        payload: {
          sessionId,
          task,
          context,
          participants: [from, ...to]
        },
        timestamp: Date.now(),
        priority: 'high',
        metadata: { conversationId: sessionId }
      })
    }

    return new CollaborationSession(sessionId, [from, ...to], this.messageBus)
  }
}

class CollaborationSession {
  constructor(
    public id: string,
    public participants: string[],
    private messageBus: MessageBus
  ) {}

  async send(from: string, message: string): Promise<void> {
    await this.messageBus.send({
      id: `collab-msg-${Date.now()}`,
      from,
      to: this.participants.filter(p => p !== from),
      type: 'collaboration',
      payload: { sessionId: this.id, message },
      timestamp: Date.now(),
      priority: 'normal',
      metadata: { conversationId: this.id }
    })
  }

  async close(): Promise<void> {
    await this.messageBus.broadcast({
      id: `collab-close-${this.id}`,
      from: 'system',
      type: 'status',
      payload: { sessionId: this.id, status: 'closed' },
      timestamp: Date.now(),
      priority: 'normal'
    })
  }
}
```

## Message Serialization

### XML Format (for LLM clarity)

```typescript
class XMLMessageSerializer {
  serialize(message: AgentMessage): string {
    return `
<message>
  <id>${message.id}</id>
  <from>${message.from}</from>
  <to>${message.to}</to>
  <type>${message.type}</type>
  <timestamp>${message.timestamp}</timestamp>
  <priority>${message.priority}</priority>
  <payload>
    ${this.serializePayload(message.payload)}
  </payload>
</message>
    `.trim()
  }

  deserialize(xml: string): AgentMessage {
    // Parse XML and reconstruct message
    // Implementation depends on XML parser
    return {} as AgentMessage
  }

  private serializePayload(payload: any): string {
    return Object.entries(payload)
      .map(([key, value]) => `<${key}>${value}</${key}>`)
      .join('\n    ')
  }
}
```

### JSON Format (for efficiency)

```typescript
class JSONMessageSerializer {
  serialize(message: AgentMessage): string {
    return JSON.stringify(message)
  }

  deserialize(json: string): AgentMessage {
    return JSON.parse(json)
  }
}
```

## Message Routing

```typescript
class MessageRouter {
  private routes: Map<string, RouteHandler> = new Map()

  registerRoute(pattern: string, handler: RouteHandler): void {
    this.routes.set(pattern, handler)
  }

  async route(message: AgentMessage): Promise<void> {
    const routeKey = `${message.type}:${message.payload.action || '*'}`

    const handler =
      this.routes.get(routeKey) ||
      this.routes.get(`${message.type}:*`) ||
      this.defaultHandler

    await handler(message)
  }

  private defaultHandler(message: AgentMessage): void {
    console.warn('No route found for message:', message)
  }
}
```

## Error Handling

```typescript
interface ErrorMessage extends AgentMessage {
  type: 'error'
  payload: {
    errorType: string
    message: string
    stack?: string
    recoverable: boolean
    originalMessageId?: string
  }
}

class ErrorHandler {
  async handleError(
    error: Error,
    context: MessageContext
  ): Promise<void> {
    const errorMessage: ErrorMessage = {
      id: `err-${Date.now()}`,
      from: context.agentId,
      to: context.requester,
      type: 'error',
      payload: {
        errorType: error.name,
        message: error.message,
        stack: error.stack,
        recoverable: this.isRecoverable(error),
        originalMessageId: context.messageId
      },
      timestamp: Date.now(),
      priority: 'high'
    }

    await context.messageBus.send(errorMessage)
  }

  private isRecoverable(error: Error): boolean {
    // Determine if error is recoverable
    return !(error instanceof FatalError)
  }
}
```

## Monitoring & Logging

```typescript
class MessageMonitor {
  private metrics = {
    messageCount: 0,
    messagesByType: new Map<MessageType, number>(),
    averageLatency: 0,
    errorRate: 0
  }

  trackMessage(message: AgentMessage): void {
    this.metrics.messageCount++

    const count = this.metrics.messagesByType.get(message.type) || 0
    this.metrics.messagesByType.set(message.type, count + 1)
  }

  trackLatency(messageId: string, latency: number): void {
    const count = this.metrics.messageCount
    const currentAvg = this.metrics.averageLatency

    this.metrics.averageLatency =
      (currentAvg * count + latency) / (count + 1)
  }

  getMetrics(): MessageMetrics {
    return { ...this.metrics }
  }
}
```

## Security

### Message Encryption

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

class SecureMessageBus implements MessageBus {
  private key: Buffer
  private algorithm = 'aes-256-gcm'

  constructor(encryptionKey: string) {
    this.key = Buffer.from(encryptionKey, 'hex')
  }

  async send(message: AgentMessage): Promise<void> {
    if (message.metadata?.encrypted) {
      message = this.encrypt(message)
    }

    // Send encrypted message
    await this.baseSend(message)
  }

  private encrypt(message: AgentMessage): AgentMessage {
    const iv = randomBytes(16)
    const cipher = createCipheriv(this.algorithm, this.key, iv)

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(message.payload), 'utf8'),
      cipher.final()
    ])

    return {
      ...message,
      payload: {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64')
      }
    }
  }

  private decrypt(message: AgentMessage): AgentMessage {
    const { encrypted, iv, authTag } = message.payload

    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'base64')
    )

    decipher.setAuthTag(Buffer.from(authTag, 'base64'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final()
    ])

    return {
      ...message,
      payload: JSON.parse(decrypted.toString('utf8'))
    }
  }
}
```

### Message Validation

```typescript
import { z } from 'zod'

const messageSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.union([z.string(), z.array(z.string()), z.literal('*')]),
  type: z.enum([
    'request', 'response', 'proposal', 'critique',
    'collaboration', 'result', 'error', 'status', 'query', 'command'
  ]),
  payload: z.any(),
  timestamp: z.number(),
  priority: z.enum(['critical', 'high', 'normal', 'low'])
})

function validateMessage(message: any): AgentMessage {
  return messageSchema.parse(message)
}
```

## Best Practices

1. **Message IDs**: Use unique, traceable message IDs
2. **Timeouts**: Set appropriate timeouts for requests
3. **Priorities**: Use priority levels for important messages
4. **Correlation**: Track related messages with correlation IDs
5. **Error Handling**: Handle message failures gracefully
6. **Monitoring**: Track message flow and performance
7. **Security**: Encrypt sensitive message payloads
8. **Validation**: Validate all incoming messages
9. **Dead Letter Queue**: Handle undeliverable messages
10. **Message TTL**: Set expiration for messages
