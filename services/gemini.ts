
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectBrief, CouncilOpinion, CouncilSession, Workflow, Project } from '../types';

// Use process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const analyzeIntake = async (userInput: string): Promise<Partial<ProjectBrief>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this automation agency client request and extract high-level structured information. User request: "${userInput}"`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          clientName: { type: Type.STRING },
          goals: { type: Type.ARRAY, items: { type: Type.STRING } },
          tools: { type: Type.ARRAY, items: { type: Type.STRING } },
          budget: { type: Type.STRING },
          riskLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] }
        },
        required: ['clientName', 'goals', 'tools', 'riskLevel']
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return {};
  }
};

export const runCouncilSession = async (projectId: string, topic: string, context: any): Promise<CouncilSession> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Execute Board Protocol 🏛️. Topic: ${topic}. Project Status: ${JSON.stringify(context)}. Provide opinions from Risk, Architecture, and Growth perspectives.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          opinions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                persona: { type: Type.STRING },
                role: { type: Type.STRING },
                opinion: { type: Type.STRING },
                score: { type: Type.NUMBER }
              },
              required: ['persona', 'role', 'opinion', 'score']
            }
          },
          synthesis: { type: Type.STRING },
          decision: { type: Type.STRING, enum: ['Approved', 'Rejected', 'Needs Revision'] }
        },
        required: ['opinions', 'synthesis', 'decision']
      }
    }
  });

  const result = JSON.parse(response.text || '{}');
  return { id: `session-${Date.now()}`, projectId, topic, ...result, gateType: 'Strategic' };
};

export const analyzeStrategicPivot = async (project: Project): Promise<{ assessment: string, recommendation: string, urgency: number }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Perform a Strategic Pivot Analysis for project: ${project.brief.clientName}. Current Status: ${project.status}. Workflows: ${project.activeWorkflows.length}. Logs: ${JSON.stringify(project.executionLogs.slice(0, 5))}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          assessment: { type: Type.STRING, description: 'Evaluation of current operational efficiency' },
          recommendation: { type: Type.STRING, description: 'Should the project pivot or persevere? Details.' },
          urgency: { type: Type.NUMBER, description: 'Scale 0-100' }
        },
        required: ['assessment', 'recommendation', 'urgency']
      }
    }
  });

  return JSON.parse(response.text || '{"assessment": "Analysis failed", "recommendation": "Manual review required", "urgency": 0}');
};

export const generateExecutiveSummary = async (projects: Project[]): Promise<string> => {
  const summaryData = projects.map(p => ({
    client: p.brief.clientName,
    status: p.status,
    revenue: p.financials.revenue
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `As the AgencyOS Intelligence Engine, provide a one-paragraph executive summary of the current agency pipeline state. Data: ${JSON.stringify(summaryData)}. Tone: Strategic, crisp, operational.`,
  });

  return response.text || "Intelligence feed offline.";
};

export const generateStrategicAdvice = async (project: Project): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze project ${project.brief.clientName} (Status: ${project.status}) and provide one hard-hitting strategic advice for growth or risk mitigation. Context: ${JSON.stringify(project.brief)}`,
  });
  return response.text || "Strategic advice engine offline.";
};

export const generateProposal = async (brief: ProjectBrief): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Draft an elite, high-fidelity automation agency proposal for ${brief.clientName}. Include solution architecture, project timeline, and ROI projections. Use Markdown format.`,
  });
  return response.text || "Proposal synthesis failed.";
};

export const generateSOW = async (project: Project): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Draft a technical Statement of Work for ${project.brief.clientName}. Focus on n8n integration details, credential security, and scope of work for the active units: ${project.activeWorkflows.map(w => w.name).join(', ')}. Use Markdown.`,
  });
  return response.text || "SOW synthesis failed.";
};

export const getOperatorResponse = async (query: string, context: any): Promise<{ content: string, toolCall?: any }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `AgencyOS Operator respond to: "${query}". Context: ${JSON.stringify({ status: context.status, workflows: context.activeWorkflows.length })}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          toolCall: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              args: { type: Type.OBJECT }
            }
          }
        },
        required: ['content']
      }
    }
  });

  return JSON.parse(response.text || '{"content": "Operator node sync timeout."}');
};

export const recommendWorkflows = async (brief: ProjectBrief, catalog: Workflow[]): Promise<{ id: string, score: number, reason: string }[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Recommend top 3 workflows from the catalog for this project brief. Brief: ${JSON.stringify(brief)}. Catalog: ${JSON.stringify(catalog.map(w => ({ id: w.id, name: w.name, tags: w.tags })))}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            score: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ['id', 'score', 'reason']
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};
