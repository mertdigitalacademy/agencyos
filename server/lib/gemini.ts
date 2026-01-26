import { GoogleGenAI, Type } from "@google/genai";
import { getEnv } from "./env";

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getEnv("GEMINI_API_KEY") ?? getEnv("API_KEY");
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export const schemas = {
  intake: {
    type: Type.OBJECT,
    properties: {
      clientName: { type: Type.STRING },
      industry: { type: Type.STRING },
      goals: { type: Type.ARRAY, items: { type: Type.STRING } },
      tools: { type: Type.ARRAY, items: { type: Type.STRING } },
      budget: { type: Type.STRING },
      riskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
    },
    required: ["clientName", "goals", "tools", "riskLevel"],
  },
  catalogRewrite: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING },
      requiredTags: { type: Type.ARRAY, items: { type: Type.STRING } },
      keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      notes: { type: Type.STRING },
    },
    required: ["query"],
  },
  council: {
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
            score: { type: Type.NUMBER },
          },
          required: ["persona", "role", "opinion", "score"],
        },
      },
      synthesis: { type: Type.STRING },
      decision: { type: Type.STRING, enum: ["Approved", "Rejected", "Needs Revision"] },
      pricing: {
        type: Type.OBJECT,
        properties: {
          currency: { type: Type.STRING },
          lineItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                cadence: { type: Type.STRING, enum: ["One-Time", "Monthly", "Usage"] },
                notes: { type: Type.STRING },
              },
              required: ["label", "amount", "cadence"],
            },
          },
          totalOneTime: { type: Type.NUMBER },
          totalMonthly: { type: Type.NUMBER },
          totalFirstMonth: { type: Type.NUMBER },
          assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
    required: ["opinions", "synthesis", "decision"],
  },
};
