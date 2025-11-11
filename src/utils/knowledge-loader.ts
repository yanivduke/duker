/**
 * Knowledge Loader
 * Loads knowledge bases into RAG system for training local LLMs
 */

import { RAGTool } from '../mcp/rag-tool.js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

export interface KnowledgeLoaderConfig {
  chromaHost?: string
  chromaPort?: number
  knowledgeDir?: string
  collectionPrefix?: string
}

export class KnowledgeLoader {
  private ragTool: RAGTool
  private knowledgeDir: string
  private collectionPrefix: string

  constructor(config: KnowledgeLoaderConfig = {}) {
    const {
      chromaHost = 'localhost',
      chromaPort = 8000,
      knowledgeDir = join(process.cwd(), 'knowledge'),
      collectionPrefix = 'duker',
    } = config

    this.ragTool = new RAGTool(chromaHost, chromaPort)
    this.knowledgeDir = knowledgeDir
    this.collectionPrefix = collectionPrefix
  }

  /**
   * Load all knowledge from knowledge directory
   */
  async loadAll(): Promise<{ success: boolean; collections: string[]; error?: string }> {
    try {
      const available = await this.ragTool.isAvailable()
      if (!available) {
        return {
          success: false,
          collections: [],
          error: 'ChromaDB server not available. Please start ChromaDB first.',
        }
      }

      const collections: string[] = []

      // Load Vue3/Vuetify3 knowledge
      const vue3Result = await this.loadVue3Knowledge()
      if (vue3Result.success) {
        collections.push(vue3Result.collection)
      }

      // Load TypeScript knowledge
      const tsResult = await this.loadTypeScriptKnowledge()
      if (tsResult.success) {
        collections.push(tsResult.collection)
      }

      // Load coding best practices
      const practicesResult = await this.loadCodingPractices()
      if (practicesResult.success) {
        collections.push(practicesResult.collection)
      }

      return {
        success: true,
        collections,
      }
    } catch (error: any) {
      return {
        success: false,
        collections: [],
        error: error.message,
      }
    }
  }

  /**
   * Load Vue3/Vuetify3 knowledge
   */
  async loadVue3Knowledge(): Promise<{ success: boolean; collection: string }> {
    const collection = `${this.collectionPrefix}-vue3-vuetify3`

    try {
      // Create collection
      await this.ragTool.execute({
        operation: 'create-collection',
        collection,
      })

      // Load guide file
      const guidePath = join(this.knowledgeDir, 'vue3-vuetify3-guide.md')
      await this.ragTool.addFromFile(collection, guidePath, 800)

      return { success: true, collection }
    } catch (error) {
      // Collection might already exist, that's okay
      return { success: true, collection }
    }
  }

  /**
   * Load TypeScript knowledge
   */
  async loadTypeScriptKnowledge(): Promise<{ success: boolean; collection: string }> {
    const collection = `${this.collectionPrefix}-typescript`

    try {
      await this.ragTool.execute({
        operation: 'create-collection',
        collection,
      })

      // Add TypeScript best practices
      const docs = [
        'Always use strict TypeScript mode. Enable strict, noImplicitAny, strictNullChecks in tsconfig.json',
        'Prefer interfaces over type aliases for object shapes. Use type aliases for unions, intersections, and primitives',
        'Use const assertions for literal types: const colors = ["red", "blue"] as const',
        'Leverage type inference. Let TypeScript infer return types when obvious',
        'Use generics for reusable type-safe functions and components',
        'Prefer unknown over any for type safety. Use type guards to narrow unknown',
        'Use discriminated unions for type-safe state machines',
        'Leverage utility types: Partial, Required, Readonly, Pick, Omit, Record',
        'Use satisfies operator for type checking without widening',
        'Document complex types with JSDoc comments',
      ]

      const ids = docs.map((_, i) => `ts-practice-${i}`)
      const metadata = docs.map((_, i) => ({ category: 'typescript', index: i }))

      await this.ragTool.execute({
        operation: 'add',
        collection,
        documents: docs,
        ids,
        metadata,
      })

      return { success: true, collection }
    } catch (error) {
      return { success: true, collection }
    }
  }

  /**
   * Load coding best practices
   */
  async loadCodingPractices(): Promise<{ success: boolean; collection: string }> {
    const collection = `${this.collectionPrefix}-best-practices`

    try {
      await this.ragTool.execute({
        operation: 'create-collection',
        collection,
      })

      const practices = [
        'Follow SOLID principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion',
        'Write small, focused functions. Each function should do one thing well',
        'Use meaningful variable and function names. Code should be self-documenting',
        'Keep functions pure when possible. Avoid side effects',
        'Handle errors explicitly. Use try-catch for async operations',
        'Write comprehensive tests. Aim for high coverage of critical paths',
        'Avoid premature optimization. Write clear code first, optimize later',
        'Use async/await over callbacks and raw promises for readability',
        'Validate input at system boundaries. Never trust external data',
        'Keep dependencies up to date. Regularly audit for security vulnerabilities',
        'Use code formatters (Prettier) and linters (ESLint) for consistency',
        'Document complex business logic and non-obvious decisions',
        'Favor composition over inheritance for code reuse',
        'Use environment variables for configuration, never hardcode secrets',
        'Implement proper logging for debugging and monitoring',
      ]

      const ids = practices.map((_, i) => `practice-${i}`)
      const metadata = practices.map((_, i) => ({ category: 'general', index: i }))

      await this.ragTool.execute({
        operation: 'add',
        collection,
        documents: practices,
        ids,
        metadata,
      })

      return { success: true, collection }
    } catch (error) {
      return { success: true, collection }
    }
  }

  /**
   * Search knowledge base
   */
  async search(
    query: string,
    collection?: string,
    limit: number = 3
  ): Promise<{ context: string; sources: string[] }> {
    try {
      const targetCollection = collection || `${this.collectionPrefix}-vue3-vuetify3`

      const result = await this.ragTool.searchWithContext(targetCollection, query, limit)

      return {
        context: result.context,
        sources: result.results.map((r) => r.id),
      }
    } catch (error) {
      return {
        context: '',
        sources: [],
      }
    }
  }

  /**
   * Get collections status
   */
  async getStatus(): Promise<{
    available: boolean
    collections: Array<{ name: string; count: number }>
  }> {
    try {
      const available = await this.ragTool.isAvailable()
      if (!available) {
        return { available: false, collections: [] }
      }

      const collectionsResult = await this.ragTool.execute({
        operation: 'list-collections',
      })

      if (!collectionsResult.success) {
        return { available: true, collections: [] }
      }

      const collectionNames = collectionsResult.data as string[]
      const dukerCollections = collectionNames.filter((name) =>
        name.startsWith(this.collectionPrefix)
      )

      const collections = await Promise.all(
        dukerCollections.map(async (name) => {
          const stats = await this.ragTool.getCollectionStats(name)
          return stats
        })
      )

      return { available: true, collections }
    } catch (error) {
      return { available: false, collections: [] }
    }
  }

  /**
   * Clear all knowledge
   */
  async clearAll(): Promise<void> {
    const status = await this.getStatus()
    for (const collection of status.collections) {
      await this.ragTool.execute({
        operation: 'delete-collection',
        collection: collection.name,
      })
    }
  }
}
