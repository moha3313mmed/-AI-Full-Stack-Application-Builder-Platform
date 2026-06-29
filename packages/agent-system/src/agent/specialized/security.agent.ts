// ============================================================================
// Security Agent - Vulnerability analysis and secure coding
// ============================================================================

import { type AIProvider } from '@builder/ai-core';

import { type AgentTask, AgentRole, AgentState, TaskStatus } from '../../types/index.js';
import { BaseAgent, type BaseAgentConfig } from '../base-agent.js';

const SECURITY_SYSTEM_PROMPT = `You are an expert security engineer. Your responsibilities include:
- Analyzing code for security vulnerabilities (OWASP Top 10)
- Implementing secure authentication and authorization
- Reviewing cryptographic implementations
- Identifying injection, XSS, and CSRF vulnerabilities
- Recommending security best practices and hardening measures

When given a task, you MUST respond with ONLY a JSON object in the following format (no additional text):
{
  "operations": [
    {"type": "create", "path": "/src/middleware/security.ts", "content": "...", "language": "typescript"},
    {"type": "update", "path": "/src/auth/auth.guard.ts", "content": "...", "language": "typescript"}
  ],
  "explanation": "Brief explanation of security findings and fixes applied"
}

Valid operation types: "create", "update", "delete"
Valid languages: "typescript", "javascript", "json", "yaml"

Ensure each file operation includes the full file content (not just snippets).
Focus on:
1. Security findings with severity ratings
2. Recommended fixes with code examples
3. Security headers and configurations
4. Authentication/authorization improvements
5. Input sanitization recommendations`;

const SECURITY_CAPABILITIES = [
  {
    name: 'vulnerability_analysis',
    description: 'Analyze code for security vulnerabilities and weaknesses',
  },
  {
    name: 'secure_coding',
    description: 'Implement secure coding patterns and practices',
  },
  {
    name: 'auth_review',
    description: 'Review and improve authentication and authorization flows',
  },
  {
    name: 'security_hardening',
    description: 'Recommend and implement security hardening measures',
  },
];

export class SecurityAgent extends BaseAgent {
  constructor(config: { id: string; provider?: AIProvider; model?: string }) {
    const baseConfig: BaseAgentConfig = {
      id: config.id,
      role: AgentRole.SECURITY,
      systemPrompt: SECURITY_SYSTEM_PROMPT,
      capabilities: SECURITY_CAPABILITIES,
      provider: config.provider,
      model: config.model,
    };
    super(baseConfig);
  }

  canHandle(taskType: string): boolean {
    const handledTypes = [
      'vulnerability_analysis',
      'secure_coding',
      'security',
      'auth_review',
      'security_hardening',
      'penetration_testing',
    ];
    return handledTypes.includes(taskType);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setState(AgentState.WORKING);

    try {
      const response = await this.callAI([
        {
          role: 'user',
          content: `Task: ${task.description}\n\nInput:\n${JSON.stringify(task.input, null, 2)}\n\nPerform security analysis and provide recommendations.`,
        },
      ]);

      const updatedTask: AgentTask = {
        ...task,
        status: TaskStatus.COMPLETED,
        output: {
          securityAnalysis: response.content,
          model: response.model,
          tokensUsed: response.usage.totalTokens,
        },
        completedAt: new Date(),
      };

      this.setState(AgentState.IDLE);
      await this.storeMemory(response.content, 'long_term', { taskId: task.id, type: 'security_analysis' });

      return updatedTask;
    } catch (error) {
      this.setState(AgentState.FAILED);
      return {
        ...task,
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
