/**
 * Security Specialist Agent
 * Handles security audits, vulnerability detection, and security design
 */

import { LLMManager } from '../../../llm/index.js'
import { BaseSpecialistAgent } from '../base-specialist.js'
import { SpecializedTask, SpecialistResult } from '../types.js'

export class SecurityAgent extends BaseSpecialistAgent {
  constructor(llmManager: LLMManager) {
    super(llmManager, 'security', [
      { name: 'vulnerability-detection', description: 'Identify security vulnerabilities in code' },
      { name: 'security-audit', description: 'Perform comprehensive security audits' },
      { name: 'auth-implementation', description: 'Design and implement authentication systems' },
      { name: 'encryption-design', description: 'Design encryption and data protection strategies' },
    ])
  }

  protected getSystemPrompt(): string {
    return `You are a Security Specialist Agent with expertise in:
- Vulnerability detection (SQL injection, XSS, CSRF, etc.)
- Security auditing and penetration testing
- Authentication and authorization design
- Encryption and data protection
- OWASP Top 10 and security best practices
- Secure coding standards

Analyze code and systems from a security perspective. Identify vulnerabilities,
assess risks, and provide actionable remediation steps. Be thorough and precise.

When analyzing:
1. Check for common vulnerabilities (OWASP Top 10)
2. Review authentication and authorization logic
3. Identify insecure data handling
4. Check for cryptographic issues
5. Review third-party dependencies for known vulnerabilities

Provide detailed security assessments with:
- Vulnerability descriptions
- Risk levels (Critical, High, Medium, Low)
- Specific code locations
- Remediation recommendations
- Code examples for fixes`
  }

  async execute(task: SpecializedTask): Promise<SpecialistResult> {
    const output = await this.generateResponse(task)

    return {
      agentId: this.id,
      specialty: this.specialty,
      task,
      output,
      confidence: this.evaluateConfidence(output),
      metadata: {
        vulnerabilitiesChecked: [
          'SQL Injection',
          'XSS',
          'CSRF',
          'Authentication bypass',
          'Insecure deserialization',
          'Security misconfiguration',
        ],
      },
    }
  }

  /**
   * Specific security audit
   */
  async auditCode(code: string): Promise<string> {
    return await this.generateResponse(
      {
        id: 'security-audit',
        description: 'Perform comprehensive security audit',
        context: { code },
      },
      'Focus on OWASP Top 10 vulnerabilities and security best practices.'
    )
  }
}
