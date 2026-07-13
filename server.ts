import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Agent Assistant Endpoint
  const handleAgentRequest = async (req: any, res: any) => {
    try {
      const { prompt, payments, history, userProfile } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
          You are the Haven Agent, an AI-powered financial assistant for a Bill and Expense Manager app called "Haven Ledger".
          Your task is to interpret the user's comments or instructions: "${prompt}"
          
          Context:
          - Current date/time: ${new Date().toISOString()}
          - Current configured payments: ${JSON.stringify(payments)}
          - User Profile: ${JSON.stringify(userProfile)}
                    Interpret what they want to do. You can:
          1. Add a recurring payment / bill / EMI / land tax (e.g. "add netflix expense of 15 dollars on day 10", "add EB bill variable subscription on day 20", "add gym membership for 45 per month")
             - If they specify that the amount varies, is variable, or they mention a variable bill like EB, electricity, or Gas bill with no fixed amount, choose paymentType: "flexi". Otherwise choose paymentType: "fixed".
          2. Mark a payment as paid or log a transaction (e.g. "mark spotify as paid", "log transaction for disney plus", "EB bill paid for $40", "gym membership paid for Father")
             - Try to match the payment name they mention with the configured payments in the context list.
             - Extract the custom amount if they specify it (e.g. "spent 40 on EB bill", extract 40 as the amount).
             - Extract the beneficiary/tag (e.g. "paid rent for Father", extract "Father" as taggedFor).
          3. Answer general questions about their expenses, budget, or how to use the app, OR ask a clarifying question if the intent was to add/pay but crucial information (like payment name) is missing.
          
          Return a structured JSON with these exact fields:
          {
            "intent": "add_expense" | "mark_paid" | "chat_clarify",
            "addExpenseData": {
              "name": string (e.g., "Netflix"),
              "amount": number (e.g., 14.99),
              "currency": string (e.g., "AUD", "USD", "INR" - default to user profile's currency or USD if unknown),
              "category": string (e.g., "Entertainment", "Utilities", "Rent", "Insurance", "Software", "Lifestyle", "EMI", "Education", "Investment", "Health", "Groceries", "Other"),
              "dayOfMonth": number (1-28),
              "billingCycle": "monthly" | "yearly" | "weekly" | "quarterly",
              "paymentMethod": "manual" | "direct_debit",
              "paymentType": "fixed" | "flexi" (default to "fixed", use "flexi" if variable amount / varying bill is mentioned or implied like Gas/EB bill)
            },
            "markPaidData": {
              "paymentId": string (The ID of the matching recurring payment from the context list. Try to match by name.),
              "paymentName": string (The name of the matched payment.),
              "amount": number (Optional. The specific paid amount if mentioned, e.g. 40 in "EB bill of $40 is paid"),
              "status": "paid" | "delayed" | "carry" (Optional. Defaults to "paid"),
              "taggedFor": string (Optional. The person/beneficiary if mentioned, e.g., "Father", "Mother", "Self")
            },
            "replyMessage": string (A friendly and professional reply. E.g. "I've logged Disney Plus as paid!", "I will add Netflix for $15/month.", or "I can add Netflix, but what is the monthly fee?")
          }
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                description: "One of: 'add_expense', 'mark_paid', 'chat_clarify'",
              },
              addExpenseData: {
                type: Type.OBJECT,
                description: "Extracted data if adding a recurring payment/bill",
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  currency: { type: Type.STRING },
                  category: { type: Type.STRING },
                  dayOfMonth: { type: Type.INTEGER },
                  billingCycle: { type: Type.STRING },
                  paymentMethod: { type: Type.STRING },
                  paymentType: { type: Type.STRING, description: "'fixed' or 'flexi'" }
                }
              },
              markPaidData: {
                type: Type.OBJECT,
                description: "Extracted data if marking a payment as paid or logging a bill",
                properties: {
                  paymentId: { type: Type.STRING },
                  paymentName: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  status: { type: Type.STRING },
                  taggedFor: { type: Type.STRING }
                }
              },
              replyMessage: {
                type: Type.STRING,
                description: "A friendly spoken/written reply to the user"
              }
            },
            required: ["intent", "replyMessage"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("Agent assistant error:", error);
      res.status(500).json({ error: error.message || "Failed to process agent command" });
    }
  };

  app.post("/api/agent", handleAgentRequest);
  app.post("/api/voice-assistant", handleAgentRequest);

  // AI Insights Endpoint
  const handleInsightsRequest = async (req: any, res: any) => {
    try {
      const { payments, history, userProfile } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
          You are the Haven Auditor, a world-class financial auditor for a Bill and Expense Manager app called "Haven Ledger".
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
              {
                "type": "warning" | "saving" | "tip" | "info",
                "title": string,
                "description": string
              }
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
                    description: { type: Type.STRING }
                  },
                  required: ["type", "title", "description"]
                }
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              forecast: { type: Type.STRING }
            },
            required: ["summary", "healthScore", "insights", "recommendations", "forecast"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("Insights API error:", error);
      res.status(500).json({ error: error.message || "Failed to generate financial insights" });
    }
  };

  app.post("/api/insights", handleInsightsRequest);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
