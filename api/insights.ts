import { Type } from "@google/genai";
import { generateContentWithFallback } from "./_gemini";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { payments, history, userProfile } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      return;
    }

    const response = await generateContentWithFallback({
      contents: `
        You are the Haven Auditor, a world-class financial auditor for a Bill and Expense Manager app called "Haven Vault".
        Your task is to analyze the user's recurring payments, bills, and EMIs, historic spending records, and family group structure to generate top-tier, smart financial insights.

        Context:
        - Current date/time: ${new Date().toISOString()}
        - Active/Inactive payments: ${JSON.stringify(payments)}
        - Historical transaction log: ${JSON.stringify(history)}
        - User Profile: ${JSON.stringify(userProfile)}

        Analyze this data and generate a JSON response summarizing:
        1. A high-level overview summary (approx. 2-3 sentences) of their current billing state, total active payment count, and family split context if relevant.
        2. A Billing Health Score (a number from 30 to 100). Be strict: start at 100, deduct for high volumes of payments, overlap of services, manual payment methods (direct debit is better), and excessive variable bills.
        3. 3 to 5 customized, actionable insights of different types ('warning' | 'saving' | 'tip' | 'info') with specific titles and descriptions based EXACTLY on their payment names and amounts.
        4. 3 to 4 cost-saving recommendations (e.g. suggesting family billing plans, bundling, canceling inactive items, setting direct debits).
        5. A 3-month spending forecast explaining whether costs will stay stable or fluctuate.

        Return a structured JSON with these exact fields:
        {
          "summary": string,
          "healthScore": number,
          "insights": [
            { "type": "warning" | "saving" | "tip" | "info", "title": string, "description": string }
          ],
          "recommendations": [string],
          "forecast": string
        }
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            healthScore: { type: Type.INTEGER },
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["type", "title", "description"],
              },
            },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            forecast: { type: Type.STRING },
          },
          required: ["summary", "healthScore", "insights", "recommendations", "forecast"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Insights API error:", error);
    res.status(500).json({ error: error.message || "Failed to generate financial insights" });
  }
}
