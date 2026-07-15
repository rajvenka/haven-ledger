import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getGeminiAI(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured on the server.");
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tries a sequence of Gemini models with retries, falling back to the next model
 * on transient errors (rate limits, temporary unavailability).
 */
export async function generateContentWithFallback(params: { contents: any; config?: any }) {
  const models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of models) {
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await getGeminiAI().models.generateContent({ model, ...params });
        return response;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        const isTransient =
          errorMessage.includes("503") ||
          errorMessage.includes("UNAVAILABLE") ||
          errorMessage.includes("429") ||
          errorMessage.includes("high demand") ||
          errorMessage.includes("temporary");

        console.warn(`[Gemini API] Model ${model} failed on attempt ${attempt}:`, errorMessage);

        if (isTransient && attempt < maxRetries) {
          await delay(attempt * 600);
        } else {
          break;
        }
      }
    }
  }

  console.error("[Gemini API] All fallback models and retries failed.");
  throw lastError || new Error("All Gemini models failed to generate content.");
}
