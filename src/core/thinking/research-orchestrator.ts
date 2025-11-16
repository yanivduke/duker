/**
 * Research Orchestrator
 *
 * Automatically triggers web searches and integrates external knowledge
 * into the reasoning process when uncertainty is detected.
 */

import { WebSearchTool } from '../../mcp/web-search-tool';
import { BaseLLMProvider } from '../../llm/base-provider';
import { ResearchNeed, ThinkingStep } from './types';

export interface ResearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    relevance: number;
  }>;
  synthesized: string; // LLM-synthesized summary
  confidence: number; // How much this helps
}

export class ResearchOrchestrator {
  constructor(
    private webSearchTool: WebSearchTool,
    private llmProvider: BaseLLMProvider
  ) {}

  /**
   * Perform research based on identified needs
   */
  async research(need: ResearchNeed): Promise<ResearchResult> {
    // Execute web search
    const searchResults = await this.executeSearch(need);

    // Synthesize results
    const synthesized = await this.synthesizeResults(need.question, searchResults, need.context);

    return {
      query: need.question,
      results: searchResults,
      synthesized,
      confidence: this.assessConfidence(searchResults),
    };
  }

  /**
   * Detect uncertainty in thinking steps
   */
  detectUncertainty(thinkingSteps: ThinkingStep[]): ResearchNeed[] {
    const needs: ResearchNeed[] = [];

    // Look for uncertainty markers in recent thinking
    const recentSteps = thinkingSteps.slice(-5);

    for (const step of recentSteps) {
      const uncertaintyMarkers = [
        'not sure',
        'uncertain',
        'unclear',
        'don\'t know',
        'might need',
        'should research',
        'need to verify',
        'need more information',
        'latest',
        'current best practice',
        'what is the',
      ];

      const content = step.content.toLowerCase();
      const hasUncertainty = uncertaintyMarkers.some(marker => content.includes(marker));

      if (hasUncertainty || step.confidence < 0.6) {
        // Extract potential research query
        const query = this.extractResearchQuery(step.content);
        if (query) {
          needs.push({
            question: query,
            urgency: step.confidence < 0.4 ? 'blocking' : 'helpful',
            searchType: this.determineSearchType(query),
            maxResults: 5,
            context: step.content,
          });
        }
      }
    }

    return needs;
  }

  /**
   * Execute web search
   */
  private async executeSearch(need: ResearchNeed): Promise<Array<{
    title: string;
    url: string;
    snippet: string;
    relevance: number;
  }>> {
    try {
      const searchParams = {
        query: this.enhanceQuery(need.question, need.searchType),
        maxResults: need.maxResults,
        searchDepth: need.urgency === 'blocking' ? 'advanced' as const : 'basic' as const,
      };

      const results = await this.webSearchTool.execute(searchParams);

      // Parse and rank results
      return this.parseSearchResults(results, need.question);
    } catch (error) {
      console.error('Web search failed:', error);
      return [];
    }
  }

  /**
   * Enhance query based on search type
   */
  private enhanceQuery(query: string, searchType: ResearchNeed['searchType']): string {
    const year = new Date().getFullYear();

    switch (searchType) {
      case 'code':
        return `${query} code example github`;
      case 'docs':
        return `${query} official documentation ${year}`;
      case 'academic':
        return `${query} research paper`;
      default:
        return `${query} best practices ${year}`;
    }
  }

  /**
   * Parse and rank search results
   */
  private parseSearchResults(
    results: any,
    query: string
  ): Array<{
    title: string;
    url: string;
    snippet: string;
    relevance: number;
  }> {
    if (!results || !Array.isArray(results)) {
      return [];
    }

    return results.map((result: any) => ({
      title: result.title || '',
      url: result.url || '',
      snippet: result.snippet || result.content || '',
      relevance: this.calculateRelevance(result, query),
    }));
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(result: any, query: string): number {
    const queryTerms = query.toLowerCase().split(' ');
    const text = `${result.title} ${result.snippet}`.toLowerCase();

    const matches = queryTerms.filter(term => text.includes(term)).length;
    return matches / queryTerms.length;
  }

  /**
   * Synthesize search results into actionable knowledge
   */
  private async synthesizeResults(
    question: string,
    results: Array<{ title: string; snippet: string; url: string }>,
    context?: string
  ): Promise<string> {
    if (results.length === 0) {
      return 'No relevant information found.';
    }

    const prompt = `Synthesize these search results to answer the question.

**Question:** ${question}

${context ? `**Context:** ${context}\n` : ''}

**Search Results:**
${results.map((r, i) => `
${i + 1}. **${r.title}**
   ${r.snippet}
   Source: ${r.url}
`).join('\n')}

Provide a concise, actionable summary (2-3 paragraphs) that:
1. Directly answers the question
2. Highlights key insights from the results
3. Mentions any conflicting information
4. Provides specific recommendations or best practices

Focus on accuracy and cite sources when making claims.`;

    try {
      const response = await this.llmProvider.generateText({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temp for factual synthesis
        maxTokens: 800,
      });

      return response.text;
    } catch (error) {
      console.error('Synthesis failed:', error);
      // Fallback to simple concatenation
      return results.map(r => `- ${r.title}: ${r.snippet}`).join('\n');
    }
  }

  /**
   * Extract research query from thinking step
   */
  private extractResearchQuery(content: string): string | null {
    // Look for explicit questions
    const questionMatch = content.match(/(?:what|how|when|where|why|which)[^.?]+\?/i);
    if (questionMatch) {
      return questionMatch[0].replace(/\?$/, '').trim();
    }

    // Look for "need to know" patterns
    const needMatch = content.match(/need to (?:know|understand|find|research) ([^.]+)/i);
    if (needMatch) {
      return needMatch[1].trim();
    }

    // Look for uncertainty about concepts
    const uncertainMatch = content.match(/(?:not sure|uncertain) about ([^.]+)/i);
    if (uncertainMatch) {
      return `what is ${uncertainMatch[1].trim()}`;
    }

    return null;
  }

  /**
   * Determine search type from query
   */
  private determineSearchType(query: string): ResearchNeed['searchType'] {
    const queryLower = query.toLowerCase();

    if (queryLower.includes('code') || queryLower.includes('implement')) {
      return 'code';
    }

    if (queryLower.includes('documentation') || queryLower.includes('api')) {
      return 'docs';
    }

    if (queryLower.includes('research') || queryLower.includes('paper')) {
      return 'academic';
    }

    return 'general';
  }

  /**
   * Assess confidence in research results
   */
  private assessConfidence(
    results: Array<{ relevance: number }>
  ): number {
    if (results.length === 0) return 0;

    const avgRelevance = results.reduce((sum, r) => sum + r.relevance, 0) / results.length;

    // Confidence based on number of results and relevance
    const volumeScore = Math.min(results.length / 5, 1); // Optimal: 5 results
    const relevanceScore = avgRelevance;

    return (volumeScore * 0.3 + relevanceScore * 0.7);
  }

  /**
   * Generate follow-up research questions
   */
  async generateFollowUpQuestions(
    originalQuestion: string,
    synthesizedAnswer: string
  ): Promise<string[]> {
    const prompt = `Given this question and answer, suggest 2-3 follow-up research questions to deepen understanding.

**Original Question:** ${originalQuestion}

**Answer:** ${synthesizedAnswer}

Suggest specific, actionable follow-up questions. Format as a simple list.`;

    try {
      const response = await this.llmProvider.generateText({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 300,
      });

      return response.text
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^[-*•]\s*/, '').trim())
        .slice(0, 3);
    } catch (error) {
      console.error('Follow-up generation failed:', error);
      return [];
    }
  }
}
