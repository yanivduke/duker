/**
 * Web Search Tool - Search the web for current information
 * Using Tavily API for AI-optimized search
 */

import {
  MCPTool,
  ToolResult,
  ToolSchema,
  PermissionDeniedError,
} from '../types/index.js'
import { PermissionManager } from '../security/index.js'

export interface SearchParams {
  query: string
  maxResults?: number
  searchDepth?: 'basic' | 'advanced'
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
  score?: number
}

export class WebSearchTool implements MCPTool {
  name = 'web-search'
  description = 'Search the web for current information'

  schema: ToolSchema = {
    parameters: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results',
        optional: true,
      },
      searchDepth: {
        type: 'string',
        description: 'Search depth: basic or advanced',
        optional: true,
      },
    },
    required: ['query'],
  }

  private permissionManager: PermissionManager
  private agentId: string
  private apiKey?: string

  constructor(permissionManager: PermissionManager, agentId: string, apiKey?: string) {
    this.permissionManager = permissionManager
    this.agentId = agentId
    this.apiKey = apiKey || process.env.TAVILY_API_KEY
  }

  async execute(params: SearchParams): Promise<ToolResult> {
    // Create operation for permission check
    const operation = this.permissionManager.createOperation(
      'network',
      'search',
      params.query,
      `Web search: ${params.query}`
    )

    // Request permission
    const decision = await this.permissionManager.requestPermission({
      id: `search-${Date.now()}`,
      operation,
      agent: this.agentId,
      context: 'Searching the web for information',
      timestamp: Date.now(),
    })

    if (!decision.granted) {
      throw new PermissionDeniedError(`Permission denied for search: ${params.query}`)
    }

    // Execute search
    if (this.apiKey) {
      return await this.searchWithTavily(params)
    } else {
      // Fallback: simulated search
      return await this.searchFallback(params)
    }
  }

  /**
   * Search using Tavily API
   */
  private async searchWithTavily(params: SearchParams): Promise<ToolResult> {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: params.query,
          max_results: params.maxResults || 5,
          search_depth: params.searchDepth || 'basic',
          include_answer: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`)
      }

      const data = (await response.json()) as {
        results: Array<{ title: string; url: string; content: string; score: number }>
        answer?: string
      }

      const results: SearchResult[] = data.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        score: r.score,
      }))

      return {
        success: true,
        data: {
          query: params.query,
          results,
          answer: data.answer,
          totalResults: results.length,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message,
      }
    }
  }

  /**
   * Fallback search (simulated)
   */
  private async searchFallback(params: SearchParams): Promise<ToolResult> {
    // This is a placeholder - in production you'd use another search API
    // or return an informative message
    return {
      success: true,
      data: {
        query: params.query,
        results: [],
        note: 'Web search requires TAVILY_API_KEY. Add it to your .env file.',
        totalResults: 0,
      },
    }
  }

  /**
   * Search specifically for code examples
   */
  async searchCode(query: string): Promise<ToolResult> {
    // Search GitHub, Stack Overflow, etc.
    const codeQuery = `${query} site:github.com OR site:stackoverflow.com`
    return await this.execute({ query: codeQuery, maxResults: 5 })
  }

  /**
   * Search for documentation
   */
  async searchDocs(query: string): Promise<ToolResult> {
    const docsQuery = `${query} documentation official docs`
    return await this.execute({ query: docsQuery, maxResults: 3 })
  }
}
