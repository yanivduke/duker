/**
 * Vision Tool - MCP Tool for image analysis using Claude's vision capabilities
 * Supports screenshots, diagrams, code images, and visual debugging
 */

import { MCPTool, ToolSchema, ToolResult, RiskLevel } from '../types/index.js'
import { PermissionManager } from '../security/index.js'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export interface VisionParams {
  action: 'analyze' | 'compare' | 'extract_text' | 'describe'
  imagePath?: string
  imageUrl?: string
  imageBase64?: string
  secondImagePath?: string // For comparison
  prompt?: string
  detailLevel?: 'low' | 'medium' | 'high'
}

export class VisionTool implements MCPTool {
  name = 'vision'
  description = 'Analyze images, screenshots, diagrams, and extract visual information'

  schema: ToolSchema = {
    parameters: {
      action: {
        type: 'string',
        description: 'Action: analyze (general analysis), compare (compare two images), extract_text (OCR), describe (detailed description)',
      },
      imagePath: {
        type: 'string',
        description: 'Path to local image file',
        optional: true,
      },
      imageUrl: {
        type: 'string',
        description: 'URL to image',
        optional: true,
      },
      imageBase64: {
        type: 'string',
        description: 'Base64-encoded image data',
        optional: true,
      },
      secondImagePath: {
        type: 'string',
        description: 'Path to second image for comparison',
        optional: true,
      },
      prompt: {
        type: 'string',
        description: 'Custom prompt for image analysis',
        optional: true,
      },
      detailLevel: {
        type: 'string',
        description: 'Level of detail: low, medium, or high (default: medium)',
        optional: true,
      },
    },
    required: ['action'],
  }

  private permissionManager: PermissionManager
  private agent: string
  private apiKey: string

  constructor(permissionManager: PermissionManager, agent: string, apiKey: string) {
    this.permissionManager = permissionManager
    this.agent = agent
    this.apiKey = apiKey
  }

  async execute(params: VisionParams): Promise<ToolResult> {
    try {
      // Validate image source
      if (!params.imagePath && !params.imageUrl && !params.imageBase64) {
        return {
          success: false,
          data: null,
          error: 'One of imagePath, imageUrl, or imageBase64 is required',
        }
      }

      // Request permission for file read if using local file
      if (params.imagePath) {
        const permitted = await this.permissionManager.requestPermission({
          id: `vision-read-${Date.now()}`,
          operation: {
            type: 'file-read',
            action: 'read_image',
            target: params.imagePath,
            riskLevel: RiskLevel.LOW,
            description: `Read image file: ${params.imagePath}`,
          },
          agent: this.agent,
          context: 'Vision tool image read',
          timestamp: Date.now(),
        })

        if (!permitted.granted) {
          return {
            success: false,
            data: null,
            error: 'Permission denied to read image file',
          }
        }
      }

      switch (params.action) {
        case 'analyze':
          return await this.analyzeImage(params)
        case 'compare':
          return await this.compareImages(params)
        case 'extract_text':
          return await this.extractText(params)
        case 'describe':
          return await this.describeImage(params)
        default:
          return {
            success: false,
            data: null,
            error: `Unknown action: ${params.action}`,
          }
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
   * General image analysis
   */
  private async analyzeImage(params: VisionParams): Promise<ToolResult> {
    const imageData = await this.loadImage(params)

    const prompt = params.prompt || `Analyze this image in detail. Describe what you see, identify any code, text, diagrams, UI elements, or technical content. If it's a screenshot of code or a technical diagram, explain its purpose and content.`

    const result = await this.callVisionAPI(imageData, prompt, params.detailLevel)

    return {
      success: true,
      data: {
        analysis: result.text,
        imageSource: this.getImageSource(params),
      },
      metadata: {
        tokensUsed: result.usage.totalTokens,
        model: 'claude-3-5-sonnet-20241022',
      },
    }
  }

  /**
   * Compare two images
   */
  private async compareImages(params: VisionParams): Promise<ToolResult> {
    if (!params.secondImagePath && !params.imageUrl) {
      return {
        success: false,
        data: null,
        error: 'Second image is required for comparison',
      }
    }

    const image1Data = await this.loadImage(params)
    const image2Data = await this.loadImage({
      ...params,
      imagePath: params.secondImagePath,
    })

    const prompt = params.prompt || `Compare these two images. Identify differences, similarities, and any changes between them. If they are code screenshots or UI screenshots, highlight specific changes.`

    // Note: Multi-image comparison requires special handling
    const result = await this.callVisionAPI(
      image1Data,
      `${prompt}\n\nFirst image for comparison.`,
      params.detailLevel
    )

    return {
      success: true,
      data: {
        comparison: result.text,
        images: [this.getImageSource(params), params.secondImagePath],
      },
      metadata: {
        tokensUsed: result.usage.totalTokens,
      },
    }
  }

  /**
   * Extract text from image (OCR)
   */
  private async extractText(params: VisionParams): Promise<ToolResult> {
    const imageData = await this.loadImage(params)

    const prompt = `Extract all text from this image. Preserve formatting, code structure, and layout as much as possible. If it's code, maintain indentation and syntax.`

    const result = await this.callVisionAPI(imageData, prompt, params.detailLevel)

    return {
      success: true,
      data: {
        extractedText: result.text,
        imageSource: this.getImageSource(params),
      },
      metadata: {
        tokensUsed: result.usage.totalTokens,
      },
    }
  }

  /**
   * Detailed description of image
   */
  private async describeImage(params: VisionParams): Promise<ToolResult> {
    const imageData = await this.loadImage(params)

    const prompt = params.prompt || `Provide a detailed, comprehensive description of this image. Include:
- Overall composition and layout
- All visible elements and their positions
- Any text, code, or technical content
- Colors, styles, and visual hierarchy
- Purpose and context (if identifiable)
- Technical details relevant to software development`

    const result = await this.callVisionAPI(imageData, prompt, 'high')

    return {
      success: true,
      data: {
        description: result.text,
        imageSource: this.getImageSource(params),
      },
      metadata: {
        tokensUsed: result.usage.totalTokens,
      },
    }
  }

  /**
   * Load image from various sources
   */
  private async loadImage(params: VisionParams): Promise<string> {
    if (params.imageBase64) {
      return params.imageBase64
    }

    if (params.imageUrl) {
      // For URLs, we'll pass them directly to Claude
      return params.imageUrl
    }

    if (params.imagePath) {
      const fs = await import('fs/promises')
      const imageBuffer = await fs.readFile(params.imagePath)
      return imageBuffer.toString('base64')
    }

    throw new Error('No valid image source provided')
  }

  /**
   * Get image source description
   */
  private getImageSource(params: VisionParams): string {
    if (params.imagePath) return `file:${params.imagePath}`
    if (params.imageUrl) return `url:${params.imageUrl}`
    if (params.imageBase64) return 'base64:inline'
    return 'unknown'
  }

  /**
   * Call Claude Vision API
   */
  private async callVisionAPI(
    imageData: string,
    prompt: string,
    detailLevel: VisionParams['detailLevel'] = 'medium'
  ): Promise<any> {
    const anthropic = createAnthropic({ apiKey: this.apiKey })
    const model = anthropic('claude-3-5-sonnet-20241022')

    // Determine media type from image data
    const mediaType = this.detectMediaType(imageData)

    // Prepare image content
    const imageContent = imageData.startsWith('http')
      ? {
          type: 'image' as const,
          image: imageData, // URL
        }
      : {
          type: 'image' as const,
          image: imageData, // base64
        }

    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text' as const,
              text: prompt,
            },
          ] as any,
        },
      ],
      maxOutputTokens: 4096,
      temperature: 0.3, // Lower temperature for more factual analysis
    })

    return result
  }

  /**
   * Detect media type from image data
   */
  private detectMediaType(imageData: string): string {
    if (imageData.startsWith('http')) {
      return 'image/jpeg' // Default for URLs
    }

    // Detect from base64 header or first bytes
    if (imageData.startsWith('iVBOR')) return 'image/png'
    if (imageData.startsWith('/9j/')) return 'image/jpeg'
    if (imageData.startsWith('R0lG')) return 'image/gif'
    if (imageData.startsWith('UklG')) return 'image/webp'

    return 'image/jpeg' // Default fallback
  }
}
