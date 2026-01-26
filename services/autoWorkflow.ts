import type { Project, Workflow } from '../types';
import * as api from './api';

export interface WorkflowSuggestion {
  workflow: Workflow;
  reason: string;
  confidence: number;
  oneClickInstall: boolean;
}

/**
 * Analyze project brief and suggest relevant workflows
 */
export async function suggestWorkflows(project: Project): Promise<WorkflowSuggestion[]> {
  try {
    // Extract keywords from project brief
    const keywords = extractKeywords(project.brief);

    // Search workflow catalog
    const searchQuery = keywords.join(' ');
    const searchResults = await api.searchWorkflowCatalog({ query: searchQuery, limit: 10 });

    if (!searchResults?.workflows || searchResults.workflows.length === 0) {
      return [];
    }

    // Score and rank workflows
    const scored = searchResults.workflows.map(workflow => {
      const score = calculateRelevanceScore(workflow, project.brief, keywords);
      const reason = generateReason(workflow, project.brief);

      return {
        workflow,
        reason,
        confidence: score,
        oneClickInstall: score > 0.6
      };
    });

    // Return top 3 most relevant
    return scored
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  } catch (error) {
    console.error('Failed to suggest workflows:', error);
    return [];
  }
}

/**
 * Extract relevant keywords from project brief
 */
function extractKeywords(brief: any): string[] {
  const keywords: string[] = [];

  // Industry
  if (brief.industry) {
    keywords.push(brief.industry.toLowerCase());
  }

  // Goals
  if (brief.goals && Array.isArray(brief.goals)) {
    brief.goals.forEach((goal: string) => {
      // Extract main concepts
      const concepts = goal
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(word => word.length > 4);
      keywords.push(...concepts);
    });
  }

  // Tools mentioned
  if (brief.tools && Array.isArray(brief.tools)) {
    keywords.push(...brief.tools.map((t: string) => t.toLowerCase()));
  }

  // Common automation patterns
  const automationKeywords = [
    'crm', 'leads', 'invoice', 'email', 'social media', 'analytics',
    'automation', 'sync', 'notification', 'report', 'tracking'
  ];

  const briefText = JSON.stringify(brief).toLowerCase();
  automationKeywords.forEach(keyword => {
    if (briefText.includes(keyword)) {
      keywords.push(keyword);
    }
  });

  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Calculate relevance score (0-1) for a workflow
 */
function calculateRelevanceScore(workflow: Workflow, brief: any, keywords: string[]): number {
  let score = 0;

  const workflowText = `${workflow.name} ${workflow.description} ${workflow.tags.join(' ')}`.toLowerCase();

  // Tag matching (high weight)
  workflow.tags.forEach(tag => {
    if (keywords.includes(tag.toLowerCase())) {
      score += 0.3;
    }
  });

  // Keyword matching (medium weight)
  keywords.forEach(keyword => {
    if (workflowText.includes(keyword)) {
      score += 0.15;
    }
  });

  // Industry matching (medium weight)
  if (brief.industry && workflowText.includes(brief.industry.toLowerCase())) {
    score += 0.2;
  }

  // Complexity matching (prefer Low/Medium for non-technical users)
  if (workflow.complexity === 'Low') {
    score += 0.1;
  } else if (workflow.complexity === 'High') {
    score -= 0.1;
  }

  // Cap at 1.0
  return Math.min(score, 1.0);
}

/**
 * Generate human-readable reason for suggestion
 */
function generateReason(workflow: Workflow, brief: any): string {
  const reasons: string[] = [];

  // Check what matched
  if (brief.industry) {
    const workflowText = `${workflow.name} ${workflow.description}`.toLowerCase();
    if (workflowText.includes(brief.industry.toLowerCase())) {
      reasons.push(`Matches your industry: ${brief.industry}`);
    }
  }

  // Check tool mentions
  if (brief.tools && Array.isArray(brief.tools)) {
    const matchedTools = brief.tools.filter((tool: string) =>
      workflow.description.toLowerCase().includes(tool.toLowerCase())
    );
    if (matchedTools.length > 0) {
      reasons.push(`Uses ${matchedTools.join(', ')}`);
    }
  }

  // Check goal alignment
  if (brief.goals && Array.isArray(brief.goals)) {
    const goalKeywords = ['automate', 'sync', 'track', 'manage', 'generate'];
    const matchedGoals = goalKeywords.filter(keyword =>
      brief.goals.some((goal: string) => goal.toLowerCase().includes(keyword)) &&
      workflow.description.toLowerCase().includes(keyword)
    );
    if (matchedGoals.length > 0) {
      reasons.push(`Helps ${matchedGoals.join(', ')}`);
    }
  }

  // Tag matching
  if (workflow.tags.length > 0) {
    reasons.push(`Tags: ${workflow.tags.slice(0, 2).join(', ')}`);
  }

  // Default reason
  if (reasons.length === 0) {
    return `${workflow.name} - ${workflow.description.slice(0, 60)}...`;
  }

  return reasons.join(' • ');
}

/**
 * Auto-install suggested workflows to project
 */
export async function autoInstallWorkflows(
  projectId: string,
  suggestions: WorkflowSuggestion[]
): Promise<{ installed: number; errors: string[] }> {
  let installed = 0;
  const errors: string[] = [];

  for (const suggestion of suggestions) {
    if (!suggestion.oneClickInstall) continue;

    try {
      await api.installWorkflowToProject(projectId, {
        workflowId: suggestion.workflow.id,
        workflowName: suggestion.workflow.name,
        workflowJsonUrl: suggestion.workflow.jsonUrl,
        credentials: suggestion.workflow.credentials || []
      });
      installed++;
    } catch (error) {
      errors.push(`Failed to install ${suggestion.workflow.name}: ${error}`);
    }
  }

  return { installed, errors };
}

/**
 * Get next recommended action for a project
 */
export function getNextAction(project: Project, lang: 'en' | 'tr' = 'en'): string {
  const workflowCount = project.activeWorkflows?.length || 0;

  if (workflowCount === 0) {
    return lang === 'tr'
      ? 'Workflow ekleyin - AI öneri göreceksiniz'
      : 'Add workflows - AI will suggest some';
  }

  const hasLiveWorkflows = project.activeWorkflows?.some(w => w.status === 'Activated');
  if (!hasLiveWorkflows) {
    return lang === 'tr'
      ? 'Workflow\'ları aktif edin'
      : 'Activate your workflows';
  }

  const hasExecutions = project.executionLogs && project.executionLogs.length > 0;
  if (!hasExecutions) {
    return lang === 'tr'
      ? 'İlk execution\'ı çalıştırın'
      : 'Run your first execution';
  }

  return lang === 'tr'
    ? 'Gelir makinesini çalıştırın'
    : 'Run your revenue machine';
}
