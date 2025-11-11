/**
 * Code Analysis MCP Tool
 * Deep code understanding for better AI assistance
 */

import { MCPTool, ToolSchema, ToolResult } from '../types/index.js'
import { readFileSync } from 'fs'
import { join } from 'path'

export interface CodeAnalysisParams {
  filePath: string
  analysisType?: 'full' | 'structure' | 'dependencies' | 'complexity' | 'patterns'
}

export interface CodeStructure {
  imports: string[]
  exports: string[]
  functions: FunctionInfo[]
  classes: ClassInfo[]
  interfaces: InterfaceInfo[]
  types: TypeInfo[]
  variables: VariableInfo[]
}

export interface FunctionInfo {
  name: string
  parameters: ParameterInfo[]
  returnType?: string
  async: boolean
  lineStart: number
  lineEnd: number
  complexity: number
  documentation?: string
}

export interface ClassInfo {
  name: string
  extends?: string
  implements: string[]
  methods: FunctionInfo[]
  properties: PropertyInfo[]
  lineStart: number
  lineEnd: number
  documentation?: string
}

export interface InterfaceInfo {
  name: string
  extends: string[]
  properties: PropertyInfo[]
  methods: FunctionInfo[]
  lineStart: number
  lineEnd: number
}

export interface TypeInfo {
  name: string
  definition: string
  lineStart: number
}

export interface VariableInfo {
  name: string
  type?: string
  isConst: boolean
  isExported: boolean
  lineNumber: number
}

export interface PropertyInfo {
  name: string
  type?: string
  visibility?: 'public' | 'private' | 'protected'
  static: boolean
  readonly: boolean
}

export interface ParameterInfo {
  name: string
  type?: string
  optional: boolean
  defaultValue?: string
}

export interface DependencyInfo {
  internal: string[] // project files
  external: string[] // npm packages
  types: string[] // type imports
}

export interface ComplexityInfo {
  cyclomaticComplexity: number
  cognitiveComplexity: number
  linesOfCode: number
  commentLines: number
  blankLines: number
  maintainabilityIndex: number
}

export interface PatternInfo {
  designPatterns: string[]
  antiPatterns: string[]
  bestPractices: string[]
  codeSmells: string[]
}

export class CodeAnalysisTool implements MCPTool {
  name = 'code-analysis'
  description = 'Analyze code structure, dependencies, complexity, and patterns'

  schema: ToolSchema = {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file to analyze',
      },
      analysisType: {
        type: 'string',
        description:
          'Type of analysis: full, structure, dependencies, complexity, or patterns',
        optional: true,
      },
    },
    required: ['filePath'],
  }

  async execute(params: CodeAnalysisParams): Promise<ToolResult> {
    try {
      const { filePath, analysisType = 'full' } = params
      const content = readFileSync(filePath, 'utf-8')
      const language = this.detectLanguage(filePath)

      const result: any = {
        filePath,
        language,
        size: content.length,
        lines: content.split('\n').length,
      }

      if (analysisType === 'full' || analysisType === 'structure') {
        result.structure = this.analyzeStructure(content, language)
      }

      if (analysisType === 'full' || analysisType === 'dependencies') {
        result.dependencies = this.analyzeDependencies(content, language)
      }

      if (analysisType === 'full' || analysisType === 'complexity') {
        result.complexity = this.analyzeComplexity(content, language)
      }

      if (analysisType === 'full' || analysisType === 'patterns') {
        result.patterns = this.analyzePatterns(content, language)
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

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript-react',
      js: 'javascript',
      jsx: 'javascript-react',
      vue: 'vue',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
    }
    return langMap[ext || ''] || 'unknown'
  }

  private analyzeStructure(content: string, language: string): CodeStructure {
    const structure: CodeStructure = {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      variables: [],
    }

    const lines = content.split('\n')

    if (language.includes('typescript') || language.includes('javascript')) {
      // Import statements
      const importRegex = /^import\s+.*from\s+['"](.+)['"]/
      const exportRegex = /^export\s+(default\s+)?(class|function|const|let|var|interface|type)\s+(\w+)/

      // Interfaces
      const interfaceRegex = /^(?:export\s+)?interface\s+(\w+)/
      const typeRegex = /^(?:export\s+)?type\s+(\w+)/

      // Classes
      const classRegex = /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/

      // Functions
      const functionRegex =
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?/
      const arrowFunctionRegex = /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*(\w+))?\s*=>/

      lines.forEach((line, index) => {
        const trimmed = line.trim()

        // Imports
        const importMatch = trimmed.match(importRegex)
        if (importMatch) {
          structure.imports.push(importMatch[1])
        }

        // Exports
        const exportMatch = trimmed.match(exportRegex)
        if (exportMatch) {
          structure.exports.push(exportMatch[3])
        }

        // Interfaces
        const interfaceMatch = trimmed.match(interfaceRegex)
        if (interfaceMatch) {
          structure.interfaces.push({
            name: interfaceMatch[1],
            extends: [],
            properties: [],
            methods: [],
            lineStart: index + 1,
            lineEnd: this.findBlockEnd(lines, index),
          })
        }

        // Types
        const typeMatch = trimmed.match(typeRegex)
        if (typeMatch) {
          structure.types.push({
            name: typeMatch[1],
            definition: trimmed,
            lineStart: index + 1,
          })
        }

        // Classes
        const classMatch = trimmed.match(classRegex)
        if (classMatch) {
          structure.classes.push({
            name: classMatch[1],
            extends: classMatch[2],
            implements: [],
            methods: [],
            properties: [],
            lineStart: index + 1,
            lineEnd: this.findBlockEnd(lines, index),
          })
        }

        // Functions
        const funcMatch = trimmed.match(functionRegex)
        if (funcMatch) {
          structure.functions.push({
            name: funcMatch[1],
            parameters: this.parseParameters(funcMatch[2]),
            returnType: funcMatch[3],
            async: trimmed.includes('async'),
            lineStart: index + 1,
            lineEnd: this.findBlockEnd(lines, index),
            complexity: 1,
          })
        }

        // Arrow functions
        const arrowMatch = trimmed.match(arrowFunctionRegex)
        if (arrowMatch) {
          structure.functions.push({
            name: arrowMatch[1],
            parameters: this.parseParameters(arrowMatch[2]),
            returnType: arrowMatch[3],
            async: trimmed.includes('async'),
            lineStart: index + 1,
            lineEnd: this.findBlockEnd(lines, index),
            complexity: 1,
          })
        }
      })
    }

    return structure
  }

  private analyzeDependencies(content: string, language: string): DependencyInfo {
    const dependencies: DependencyInfo = {
      internal: [],
      external: [],
      types: [],
    }

    if (language.includes('typescript') || language.includes('javascript')) {
      const importRegex = /^import\s+.*from\s+['"](.+)['"]/gm
      const matches = content.matchAll(importRegex)

      for (const match of matches) {
        const importPath = match[1]

        if (importPath.startsWith('.')) {
          dependencies.internal.push(importPath)
        } else if (importPath.startsWith('@types/')) {
          dependencies.types.push(importPath)
        } else {
          dependencies.external.push(importPath)
        }
      }
    }

    return dependencies
  }

  private analyzeComplexity(content: string, language: string): ComplexityInfo {
    const lines = content.split('\n')
    let linesOfCode = 0
    let commentLines = 0
    let blankLines = 0

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (trimmed === '') {
        blankLines++
      } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        commentLines++
      } else {
        linesOfCode++
      }
    })

    // Cyclomatic complexity (simplified)
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(content)

    // Cognitive complexity (simplified)
    const cognitiveComplexity = this.calculateCognitiveComplexity(content)

    // Maintainability index (simplified formula)
    const maintainabilityIndex = Math.max(
      0,
      100 - cyclomaticComplexity * 2 - (linesOfCode / 10)
    )

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      commentLines,
      blankLines,
      maintainabilityIndex: Math.round(maintainabilityIndex),
    }
  }

  private analyzePatterns(content: string, language: string): PatternInfo {
    const patterns: PatternInfo = {
      designPatterns: [],
      antiPatterns: [],
      bestPractices: [],
      codeSmells: [],
    }

    // Detect common design patterns
    if (content.includes('class') && content.includes('getInstance')) {
      patterns.designPatterns.push('Singleton')
    }
    if (content.includes('abstract class') || content.includes('interface')) {
      patterns.designPatterns.push('Abstraction')
    }
    if (content.includes('observer') || content.includes('subscribe')) {
      patterns.designPatterns.push('Observer')
    }

    // Detect anti-patterns
    if (content.match(/function\s+\w+\s*\([^)]*\)\s*{[\s\S]{500,}}/)) {
      patterns.antiPatterns.push('God Function')
    }
    if ((content.match(/if\s*\(/g) || []).length > 10) {
      patterns.antiPatterns.push('Excessive Conditionals')
    }

    // Best practices
    if (content.includes('try') && content.includes('catch')) {
      patterns.bestPractices.push('Error Handling')
    }
    if (content.match(/\/\*\*[\s\S]*?\*\//)) {
      patterns.bestPractices.push('Documentation')
    }
    if (content.includes('async') && content.includes('await')) {
      patterns.bestPractices.push('Async/Await Usage')
    }

    // Code smells
    if (content.match(/var\s+/)) {
      patterns.codeSmells.push('Using var instead of let/const')
    }
    if ((content.match(/any/g) || []).length > 5 && language.includes('typescript')) {
      patterns.codeSmells.push('Excessive any types')
    }

    return patterns
  }

  private calculateCyclomaticComplexity(content: string): number {
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\&\&/g,
      /\|\|/g,
      /\?/g,
    ]

    let complexity = 1 // Base complexity

    patterns.forEach((pattern) => {
      const matches = content.match(pattern)
      if (matches) {
        complexity += matches.length
      }
    })

    return complexity
  }

  private calculateCognitiveComplexity(content: string): number {
    let complexity = 0
    let nestingLevel = 0

    const lines = content.split('\n')

    lines.forEach((line) => {
      const trimmed = line.trim()

      // Increase nesting
      if (trimmed.match(/\{$/)) {
        nestingLevel++
      }

      // Decrease nesting
      if (trimmed.match(/^\}/)) {
        nestingLevel = Math.max(0, nestingLevel - 1)
      }

      // Add complexity for control structures
      if (trimmed.match(/\b(if|for|while|catch)\s*\(/)) {
        complexity += 1 + nestingLevel
      }

      // Add complexity for logical operators
      const logicalOps = (trimmed.match(/(\&\&|\|\|)/g) || []).length
      complexity += logicalOps
    })

    return complexity
  }

  private parseParameters(paramStr: string): ParameterInfo[] {
    if (!paramStr.trim()) return []

    return paramStr.split(',').map((param) => {
      const trimmed = param.trim()
      const parts = trimmed.split(':')
      const namePart = parts[0].trim()
      const typePart = parts[1]?.trim()

      const optional = namePart.includes('?')
      const hasDefault = namePart.includes('=')

      const name = namePart.replace(/[?=].*/, '').trim()
      const defaultValue = hasDefault ? namePart.split('=')[1]?.trim() : undefined

      return {
        name,
        type: typePart,
        optional,
        defaultValue,
      }
    })
  }

  private findBlockEnd(lines: string[], startIndex: number): number {
    let braceCount = 0
    let started = false

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]

      for (const char of line) {
        if (char === '{') {
          braceCount++
          started = true
        } else if (char === '}') {
          braceCount--
          if (started && braceCount === 0) {
            return i + 1
          }
        }
      }
    }

    return startIndex + 1
  }
}
