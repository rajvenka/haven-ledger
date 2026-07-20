import { Type } from "@google/genai";
import { generateContentWithFallback } from "./_gemini.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { rewardsPerks } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      return;
    }

    if (!Array.isArray(rewardsPerks) || rewardsPerks.length === 0) {
      res.status(200).json({
        summary: "No rewards or perks tracked yet — add a credit card, loyalty program, or offer to get personalized advice.",
        tips: [],
        watchouts: [],
      });
      return;
    }

    const response = await generateContentWithFallback({
      contents: `
        You are a sharp, no-nonsense personal finance advisor specializing in credit card rewards, loyalty points, and sign-up bonus optimization ("credit card churning" / "points hacking"), for an Australian audience by default unless stated otherwise.

        Current date: ${new Date().toISOString()}
        The user's tracked rewards, perks, and cards:
        ${JSON.stringify(rewardsPerks)}

        Analyze this portfolio and provide:
        1. A short (2-3 sentence) plain-English summary of how well they're doing overall — are they net positive, carrying too many annual fees, sitting on unused points, etc.
        2. 2-4 specific, actionable tips (e.g. "cancel X before the annual fee hits", "you're eligible to reapply for Y's bonus again on [date]", "convert your Z points before they expire", "you have overlapping cashback categories on two cards").
        3. 1-3 "watchouts" — risks or mistakes to avoid (e.g. applying for two cards too close together hurting credit score, letting an exclusion period lapse, an annual fee about to auto-renew).

        Be specific and reference the actual providers/cards by name from their data. Do not invent generic advice that ignores their actual portfolio.

        Return JSON with exactly these fields:
        {
          "summary": string,
          "tips": [string],
          "watchouts": [string]
        }
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } },
            watchouts: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["summary", "tips", "watchouts"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Rewards insights error:", error);
    res.status(500).json({ error: error.message || "Failed to generate rewards insights" });
  }
}
