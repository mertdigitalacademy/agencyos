import { getGeminiClient } from './gemini';

export interface VisualAnalysis {
  brandColors?: string[]; // Hex color codes
  visualStyle?: string; // "Modern", "Minimalist", "Corporate", etc.
  industry?: string; // Detected industry
  requirements?: string[]; // Extracted requirements
  transcript?: string; // For video/audio
  confidence?: number; // 0-1
}

/**
 * Analyze an image or video using Gemini 2.0 Flash multimodal capabilities
 */
export async function analyzeVisual(
  fileBuffer: Buffer,
  mimeType: string
): Promise<VisualAnalysis> {
  const genAI = getGeminiClient();

  // Use Gemini 2.0 Flash for multimodal analysis
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    }
  });

  const isVideo = mimeType.startsWith('video/');
  const isImage = mimeType.startsWith('image/');

  if (!isVideo && !isImage) {
    throw new Error(`Unsupported file type: ${mimeType}. Only images and videos are supported.`);
  }

  const base64Data = fileBuffer.toString('base64');

  const prompt = isVideo
    ? `Analyze this video for a client project brief. Extract:
1. Brand colors (if logo/branding visible) - provide hex codes
2. Visual style (modern, minimalist, corporate, creative, etc.)
3. Industry/business type
4. Key requirements or features mentioned
5. Full transcript of any spoken content

Return JSON format:
{
  "brandColors": ["#hex1", "#hex2"],
  "visualStyle": "description",
  "industry": "industry name",
  "requirements": ["req1", "req2"],
  "transcript": "full transcript",
  "confidence": 0.85
}`
    : `Analyze this image for a client project brief. Extract:
1. Brand colors (if logo/branding visible) - provide hex codes
2. Visual style (modern, minimalist, corporate, creative, etc.)
3. Industry/business type based on visual elements
4. Any text or requirements visible in the image

Return JSON format:
{
  "brandColors": ["#hex1", "#hex2"],
  "visualStyle": "description",
  "industry": "industry name",
  "requirements": ["req1", "req2"],
  "confidence": 0.85
}`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);

    const response = result.response;
    const text = response.text();

    // Extract JSON from response (handles cases where model adds extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Gemini response');
    }

    const analysis: VisualAnalysis = JSON.parse(jsonMatch[0]);

    // Validate and clean up the response
    if (analysis.brandColors) {
      analysis.brandColors = analysis.brandColors.filter(color => /^#[0-9A-Fa-f]{6}$/.test(color));
    }

    if (analysis.confidence === undefined) {
      analysis.confidence = 0.7; // Default confidence
    }

    return analysis;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Gemini vision analysis failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Analyze multiple files and merge the results
 */
export async function analyzeMultipleVisuals(
  files: Array<{ buffer: Buffer; mimeType: string }>
): Promise<VisualAnalysis> {
  const analyses = await Promise.all(
    files.map(file => analyzeVisual(file.buffer, file.mimeType))
  );

  // Merge results - take highest confidence values
  const merged: VisualAnalysis = {
    brandColors: [],
    requirements: [],
    confidence: 0
  };

  for (const analysis of analyses) {
    // Merge brand colors (unique)
    if (analysis.brandColors) {
      merged.brandColors = [
        ...new Set([...(merged.brandColors || []), ...analysis.brandColors])
      ];
    }

    // Merge requirements (unique)
    if (analysis.requirements) {
      merged.requirements = [
        ...new Set([...(merged.requirements || []), ...analysis.requirements])
      ];
    }

    // Take industry from highest confidence
    if (analysis.industry && (analysis.confidence || 0) > (merged.confidence || 0)) {
      merged.industry = analysis.industry;
      merged.visualStyle = analysis.visualStyle;
    }

    // Concatenate transcripts
    if (analysis.transcript) {
      merged.transcript = merged.transcript
        ? `${merged.transcript}\n\n${analysis.transcript}`
        : analysis.transcript;
    }

    // Average confidence
    merged.confidence = ((merged.confidence || 0) + (analysis.confidence || 0)) / 2;
  }

  return merged;
}

/**
 * Extract text from image using Gemini OCR capabilities
 */
export async function extractTextFromImage(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const base64Data = fileBuffer.toString('base64');

  const result = await model.generateContent([
    'Extract all visible text from this image. Return only the extracted text, nothing else.',
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    }
  ]);

  return result.response.text();
}
