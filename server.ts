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
      const { prompt, payments, history, userProfile, chatHistory } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
          You are the Haven Agent, an AI-powered financial assistant for a Bill and Expense Manager app called "Haven Ledger".
          Your task is to interpret the user's comments or instructions.
          
          Context:
          - Current date/time: ${new Date().toISOString()}
          - Current configured payments: ${JSON.stringify(payments)}
          - User Profile: ${JSON.stringify(userProfile)}
          - Recent Conversation History:
          ${chatHistory && Array.isArray(chatHistory) ? chatHistory.map((m: any) => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n') : '(None)'}
          - New User Input: "${prompt}"

          *** IMPORTANT: DATA COLLECTION FIRST POLICY ***
          When a user wants to perform an action (like adding a recurring bill/payment, or logging a transaction/marking a bill as paid) but some of the crucial information is missing, you MUST NOT execute the action with default or placeholder values!
          Instead, you MUST set the intent to "chat_clarify" and ask the user a polite, focused question to collect the missing data.
          
          Guidelines for Data Collection:
          1. Adding a new recurring bill/payment (intent: "add_expense"):
             To perform this action, you need:
             - Name of the bill (e.g., "Gas Bill", "Rent")
             - Amount/Cost (e.g., 50)
             - Due Day/Date (day of month, 1-28)
             - Billing Cycle (monthly, yearly, weekly)
             - Paid or not (whether the current cycle is already paid or not)
             If any of these key details are missing in the user's request and conversation history, set intent to "chat_clarify" and ask for the missing details.
             For example: "I can help you add your Gas Bill, but how much is it usually, what day of the month is it due, and is the current cycle already paid?"
             Only when you have gathered all these details through conversation should you set intent to "add_expense" and provide the "addExpenseData". Set "isPaid" to true if they confirm the current cycle/month is already paid.

          2. Adding multiple/bulk bills (intent: "add_bulk_expenses"):
             If the user wants to add multiple bills in bulk (e.g. "add Gas bill, Water bill and Rent" or "add these bills in bulk: Netflix 15 AUD, Rent 2400 AUD"):
             To perform this action, you need:
             - For EACH bill: Name, Amount, Due Day/Date, Billing Cycle, and Paid status.
             If details are missing for any of the bills, set intent to "chat_clarify" and ask a consolidated, clear question to collect the missing details for each bill.
             Only when you have gathered ALL necessary details for ALL the bills should you set intent to "add_bulk_expenses" and provide "addBulkExpenseData".

          3. Logging/Marking a bill as paid (intent: "mark_paid"):
             To perform this action, you need:
             - Name of the bill/payment (must correspond to an existing payment in the list, or be clarified)
             - Amount paid (how much)
             - Beneficiary/Person (e.g., "Self", "Father", "Mother", etc. - who paid or who it is for)
             If details are ambiguous or missing, set intent to "chat_clarify" and ask for clarification first.
             Only when you have confirmed these details should you set intent to "mark_paid".

          If the user's input is a general question, or doesn't request adding/paying a bill, or if you're clarifying information, set intent to "chat_clarify" and write a friendly reply.

          Return a structured JSON with these exact fields:
          {
            "intent": "add_expense" | "add_bulk_expenses" | "mark_paid" | "chat_clarify",
            "addExpenseData": {
              "name": string (e.g., "Netflix"),
              "amount": number (e.g., 14.99),
              "currency": string (e.g., "AUD", "USD", "INR" - default to user profile's currency or USD if unknown),
              "category": string (e.g., "Entertainment", "Utilities", "Rent", "Insurance", "Software", "Lifestyle", "EMI", "Education", "Investment", "Health", "Groceries", "Other"),
              "dayOfMonth": number (1-28),
              "billingCycle": "monthly" | "yearly" | "weekly" | "quarterly",
              "paymentMethod": "manual" | "direct_debit",
              "paymentType": "fixed" | "flexi",
              "isPaid": boolean
            },
            "addBulkExpenseData": [
              {
                "name": string,
                "amount": number,
                "currency": string,
                "category": string,
                "dayOfMonth": number,
                "billingCycle": "monthly" | "yearly" | "weekly" | "quarterly",
                "paymentMethod": "manual" | "direct_debit",
                "paymentType": "fixed" | "flexi",
                "isPaid": boolean
              }
            ],
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
                description: "One of: 'add_expense', 'add_bulk_expenses', 'mark_paid', 'chat_clarify'",
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
                  paymentType: { type: Type.STRING, description: "'fixed' or 'flexi'" },
                  isPaid: { type: Type.BOOLEAN, description: "Whether the current cycle/month is already paid" }
                }
              },
              addBulkExpenseData: {
                type: Type.ARRAY,
                description: "Extracted data if adding multiple/bulk recurring payments/bills",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    currency: { type: Type.STRING },
                    category: { type: Type.STRING },
                    dayOfMonth: { type: Type.INTEGER },
                    billingCycle: { type: Type.STRING },
                    paymentMethod: { type: Type.STRING },
                    paymentType: { type: Type.STRING, description: "'fixed' or 'flexi'" },
                    isPaid: { type: Type.BOOLEAN, description: "Whether the current cycle/month is already paid" }
                  },
                  required: ["name", "amount", "dayOfMonth"]
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
