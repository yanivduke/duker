/**
 * RAG (Retrieval-Augmented Generation) MCP Tool
 * Vector database for semantic search and knowledge retrieval
 */

import { MCPTool, ToolSchema, ToolResult } from '../types/index.js'
import { ChromaClient, Collection } from 'chromadb'

export interface RAGParams {
  operation:
    | 'add'
    | 'search'
    | 'delete'
    | 'update'
    | 'list-collections'
    | 'create-collection'
    | 'delete-collection'
  collection?: string
  query?: string
  documents?: string[]
  ids?: string[]
  metadata?: Record<string, any>[]
  limit?: number
}

export interface SearchResult {
  id: string
  document: string
  metadata: Record<string, any>
  distance: number
  relevance: number
}

export class RAGTool implements MCPTool {
  name = 'rag'
  description = 'Vector database operations for semantic search and knowledge retrieval'

  schema: ToolSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description:
          'Operation: add, search, delete, update, list-collections, create-collection, delete-collection',
      },
      collection: {
        type: 'string',
        description: 'Collection name',
        optional: true,
      },
      query: {
        type: 'string',
        description: 'Search query for semantic search',
        optional: true,
      },
      documents: {
        type: 'array',
        description: 'Documents to add or update',
        optional: true,
      },
      ids: {
        type: 'array',
        description: 'Document IDs',
        optional: true,
      },
      metadata: {
        type: 'array',
        description: 'Metadata for documents',
        optional: true,
      },
      limit: {
        type: 'number',
        description: 'Number of results to return',
        optional: true,
      },
    },
    required: ['operation'],
  }

  private client: ChromaClient
  private collections: Map<string, Collection> = new Map()

  constructor(host: string = 'localhost', port: number = 8000) {
    this.client = new ChromaClient({ path: `http://${host}:${port}` })
  }

  async execute(params: RAGParams): Promise<ToolResult> {
    try {
      const { operation } = params

      let result: any

      switch (operation) {
        case 'create-collection':
          result = await this.createCollection(params.collection!)
          break
        case 'delete-collection':
          result = await this.deleteCollection(params.collection!)
          break
        case 'list-collections':
          result = await this.listCollections()
          break
        case 'add':
          result = await this.addDocuments(
            params.collection!,
            params.documents!,
            params.ids!,
            params.metadata
          )
          break
        case 'search':
          result = await this.search(
            params.collection!,
            params.query!,
            params.limit || 5
          )
          break
        case 'delete':
          result = await this.deleteDocuments(params.collection!, params.ids!)
          break
        case 'update':
          result = await this.updateDocuments(
            params.collection!,
            params.ids!,
            params.documents,
            params.metadata
          )
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      return {
        success: true,
        data: result,
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message,
      }
    }
  }

  private async createCollection(name: string): Promise<{ name: string }> {
    const collection = await this.client.createCollection({ name })
    this.collections.set(name, collection)
    return { name }
  }

  private async deleteCollection(name: string): Promise<{ deleted: boolean }> {
    await this.client.deleteCollection({ name })
    this.collections.delete(name)
    return { deleted: true }
  }

  private async listCollections(): Promise<string[]> {
    const collections = await this.client.listCollections()
    // ChromaDB returns an array of collection objects or strings depending on version
    return collections.map((c: any) => (typeof c === 'string' ? c : c.name))
  }

  private async getCollection(name: string): Promise<Collection> {
    if (!this.collections.has(name)) {
      try {
        // ChromaDB v1.8+ requires embeddingFunction parameter
        const collection = await this.client.getCollection({
          name,
          embeddingFunction: undefined as any, // Use default embedding function
        })
        this.collections.set(name, collection)
      } catch {
        // Collection doesn't exist, create it
        const collection = await this.client.createCollection({ name })
        this.collections.set(name, collection)
      }
    }
    return this.collections.get(name)!
  }

  private async addDocuments(
    collectionName: string,
    documents: string[],
    ids: string[],
    metadata?: Record<string, any>[]
  ): Promise<{ added: number }> {
    const collection = await this.getCollection(collectionName)

    await collection.add({
      ids,
      documents,
      metadatas: metadata,
    })

    return { added: documents.length }
  }

  private async search(
    collectionName: string,
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    const collection = await this.getCollection(collectionName)

    const results = await collection.query({
      queryTexts: [query],
      nResults: limit,
    })

    if (!results.ids || results.ids.length === 0 || !results.ids[0]) {
      return []
    }

    return results.ids[0].map((id, index) => {
      const distance = results.distances?.[0]?.[index] ?? 1
      const relevance = 1 - distance // Convert distance to relevance score

      return {
        id,
        document: results.documents?.[0]?.[index] ?? '',
        metadata: results.metadatas?.[0]?.[index] ?? {},
        distance,
        relevance: Math.max(0, Math.min(1, relevance)),
      }
    })
  }

  private async deleteDocuments(
    collectionName: string,
    ids: string[]
  ): Promise<{ deleted: number }> {
    const collection = await this.getCollection(collectionName)

    await collection.delete({
      ids,
    })

    return { deleted: ids.length }
  }

  private async updateDocuments(
    collectionName: string,
    ids: string[],
    documents?: string[],
    metadata?: Record<string, any>[]
  ): Promise<{ updated: number }> {
    const collection = await this.getCollection(collectionName)

    await collection.update({
      ids,
      documents,
      metadatas: metadata,
    })

    return { updated: ids.length }
  }

  /**
   * Check if ChromaDB server is running
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.heartbeat()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get collection stats
   */
  async getCollectionStats(
    collectionName: string
  ): Promise<{ name: string; count: number }> {
    const collection = await this.getCollection(collectionName)
    const count = await collection.count()

    return {
      name: collectionName,
      count,
    }
  }

  /**
   * Batch add documents from file
   */
  async addFromFile(
    collectionName: string,
    filePath: string,
    chunkSize: number = 500
  ): Promise<{ added: number }> {
    const fs = await import('fs')
    const content = fs.readFileSync(filePath, 'utf-8')

    // Split into chunks
    const chunks = this.chunkText(content, chunkSize)
    const ids = chunks.map((_, i) => `${filePath}-chunk-${i}`)
    const metadata = chunks.map((chunk, i) => ({
      source: filePath,
      chunkIndex: i,
      chunkSize: chunk.length,
    }))

    return await this.addDocuments(collectionName, chunks, ids, metadata)
  }

  /**
   * Search with context
   */
  async searchWithContext(
    collectionName: string,
    query: string,
    limit: number = 5
  ): Promise<{ results: SearchResult[]; context: string }> {
    const results = await this.search(collectionName, query, limit)

    const context = results
      .map((r, i) => `[${i + 1}] (relevance: ${(r.relevance * 100).toFixed(1)}%)\n${r.document}`)
      .join('\n\n---\n\n')

    return { results, context }
  }

  private chunkText(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = []
    const paragraphs = text.split('\n\n')

    let currentChunk = ''

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = ''
        }

        // If paragraph itself is too large, split by sentences
        if (paragraph.length > maxChunkSize) {
          const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph]
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize) {
              if (currentChunk) {
                chunks.push(currentChunk.trim())
              }
              currentChunk = sentence
            } else {
              currentChunk += sentence
            }
          }
        } else {
          currentChunk = paragraph
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }
}
