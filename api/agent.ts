import { GoogleGenAI, Type } from "@google/genai";


const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { prompt, payments, history, userProfile, chatHistory } = req.body || {};

    if (!prompt) {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `
        You are the Haven Agent, an AI-powered financial assistant for a Bill and Expense Manager app called "Haven Vault".
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

        4. Updating an existing bill (intent: "update_expense"):
           If the user wants to change details of an existing configured payment (e.g. "change Netflix to $18", "move rent due date to the 3rd"):
           - Identify the matching payment from the context list by name (fuzzy match ok).
           - Only change the fields the user mentioned; leave others as-is.
           - If you cannot confidently match an existing payment, set intent to "chat_clarify" and ask which bill they mean.

        If the user's input is a general question, or doesn't request adding/paying/updating a bill, or if you're clarifying information, set intent to "chat_clarify" and write a friendly reply.

        Return a structured JSON with these exact fields:
        {
          "intent": "add_expense" | "add_bulk_expenses" | "mark_paid" | "update_expense" | "chat_clarify",
          "addExpenseData": {
            "name": string,
            "amount": number,
            "currency": string (default to user profile's currency or AUD if unknown),
            "category": string (e.g., "Entertainment", "Utilities", "Rent", "Insurance", "Software", "Lifestyle", "EMI", "Education", "Investment", "Health", "Groceries", "Other"),
            "dayOfMonth": number (1-28),
            "billingCycle": "monthly" | "yearly" | "weekly" | "quarterly",
            "paymentMethod": "manual" | "direct_debit",
            "paymentType": "fixed" | "flexi",
            "isPaid": boolean
          },
          "addBulkExpenseData": [ { same shape as addExpenseData } ],
          "markPaidData": {
            "paymentId": string,
            "paymentName": string,
            "amount": number,
            "status": "paid" | "delayed" | "carry",
            "taggedFor": string
          },
          "updateExpenseData": {
            "paymentId": string,
            "paymentName": string,
            "name": string,
            "amount": number,
            "currency": string,
            "category": string,
            "dayOfMonth": number,
            "billingCycle": string,
            "paymentMethod": string,
            "paymentType": string,
            "active": boolean
          },
          "replyMessage": string (A friendly, professional reply. E.g. "I've logged Disney Plus as paid!", "I will add Netflix for $15/month.", or "I can add Netflix, but what is the monthly fee?")
        }
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING, description: "One of: 'add_expense', 'add_bulk_expenses', 'mark_paid', 'update_expense', 'chat_clarify'" },
            addExpenseData: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                category: { type: Type.STRING },
                dayOfMonth: { type: Type.INTEGER },
                billingCycle: { type: Type.STRING },
                paymentMethod: { type: Type.STRING },
                paymentType: { type: Type.STRING },
                isPaid: { type: Type.BOOLEAN },
              },
            },
            addBulkExpenseData: {
              type: Type.ARRAY,
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
                  paymentType: { type: Type.STRING },
                  isPaid: { type: Type.BOOLEAN },
                },
                required: ["name", "amount", "dayOfMonth"],
              },
            },
            markPaidData: {
              type: Type.OBJECT,
              properties: {
                paymentId: { type: Type.STRING },
                paymentName: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                status: { type: Type.STRING },
                taggedFor: { type: Type.STRING },
              },
            },
            updateExpenseData: {
              type: Type.OBJECT,
              properties: {
                paymentId: { type: Type.STRING },
                paymentName: { type: Type.STRING },
                name: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                category: { type: Type.STRING },
                dayOfMonth: { type: Type.INTEGER },
                billingCycle: { type: Type.STRING },
                paymentMethod: { type: Type.STRING },
                paymentType: { type: Type.STRING },
                active: { type: Type.BOOLEAN },
              },
            },
            replyMessage: { type: Type.STRING },
          },
          required: ["intent", "replyMessage"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Agent assistant error:", error);
    res.status(500).json({ error: error.message || "Failed to process agent command" });
  }
}
