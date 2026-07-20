import { Type } from "@google/genai";
import { generateContentWithFallback } from "./_gemini.js";

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

    const response = await generateContentWithFallback({
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

        *** CRITICAL: FIELD VALUES MUST BE FINAL, CLEAN DATA — NEVER YOUR REASONING ***
        Every field in your JSON output (name, taggedFor, notes, category, etc.) must contain ONLY the final, clean value — a short name, a number, or null/omitted.
        NEVER write out your thought process, uncertainty, or deliberation as the content of a field (e.g. never write something like "or we can omit it but let's just..." as a field's value).
        If you are unsure whether a field applies, the correct action is to OMIT that field entirely or set it to null — not to describe your uncertainty inside the field itself.
        Every field value must be short (under 40 characters for names/tags) and read like real data a human typed, never like a sentence explaining a decision.

        *** CRITICAL: FOLLOW-UP QUESTIONS & DATA COLLECTION RULES ***
        You MUST gather all essential details before executing any financial action. NEVER use dummy, default, or guessed values for key details.

        1. Adding a recurring bill or payment (intent: "add_expense"):
           To execute this action, you STRICTLY need all 4 of these details:
           - Name of the bill (e.g., "Netflix", "Gas Bill")
           - Amount/Cost (must be a positive number, e.g., 15)
           - Due Day/Date (day of month, e.g., 12)
           - Billing Cycle (e.g., "weekly", "monthly", "yearly", or "once" for one-off transactions)

           If ANY of these 4 details are missing from the user's prompt or the Recent Conversation History, you are STRICTLY FORBIDDEN from choosing "add_expense"!
           Instead, you MUST set the intent to "chat_clarify" and write a polite, conversational response asking the user specifically for the missing details (e.g., "I can help you add your Netflix bill, but how much is the subscription fee, what day of the month is it due, and what is the billing cycle?").
           Only choose "add_expense" when ALL 4 details are known or confirmed by the user.

        2. Bulk bill insertion (intent: "add_bulk_expenses"):
           - For EACH bill, you need its Name, Amount, and Due Day.
           - If any of these are missing for any bill in the bulk list, you MUST choose "chat_clarify" and ask a consolidated clarification question.

        3. Logging or marking a bill as paid (intent: "mark_paid"):
           - You need the specific payment name (corresponding to one of the configured bills in the current list) and the amount.
           - If the user says "add transaction" or "log transaction" but does not name which bill it is, or if the name doesn't match, you MUST set the intent to "chat_clarify" and ask them to clarify which bill they are paying.

        4. Updating an existing bill (intent: "update_expense"):
           If the user wants to change details of an existing configured payment (e.g. "change Netflix to $18", "move rent due date to the 3rd"):
           - Identify the matching payment from the context list by name (fuzzy match ok).
           - Only change the fields the user mentioned; leave others as-is.
           - If you cannot confidently match an existing payment, set intent to "chat_clarify" and ask which bill they mean.

        5. Rule for general "add transaction" / "add payment" requests:
           - If the user says "add a transaction", "add transaction", "log a payment", or "add payment" without naming a specific bill or specifying details, they may be trying to log a paid payment or create a recurring bill. Treat this as highly ambiguous.
           - You MUST set intent to "chat_clarify" and ask them: "Would you like to add a new recurring bill/payment, or log a transaction for an existing bill? Please tell me the name of the bill, the amount, and the due day of the month."

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

    // SAFETY NET: strip any field value that looks like leaked model reasoning
    // (long, sentence-like, full of hedging words) rather than real data.
    const REASONING_MARKERS = /\b(let'?s|we can|actually|or omit|or null|wait|as applicable|not required|to be safe)\b/i;
    function isSuspiciousText(val: any): boolean {
      if (typeof val !== "string") return false;
      if (val.length > 60) return true;
      if (REASONING_MARKERS.test(val)) return true;
      if ((val.match(/-/g) || []).length > 5) return true; // reasoning often chains words-with-hyphens
      return false;
    }
    function sanitizeObject(obj: any) {
      if (!obj || typeof obj !== "object") return;
      for (const key of Object.keys(obj)) {
        if (isSuspiciousText(obj[key])) {
          console.warn(`[Agent] Stripped suspicious field "${key}":`, String(obj[key]).slice(0, 80));
          delete obj[key];
        }
      }
    }
    sanitizeObject(result.addExpenseData);
    sanitizeObject(result.markPaidData);
    sanitizeObject(result.updateExpenseData);
    if (Array.isArray(result.addBulkExpenseData)) result.addBulkExpenseData.forEach(sanitizeObject);

    // STRICT SERVER-SIDE INTERCEPT VALIDATION
    // If the model returned "add_expense" but is missing crucial details, convert it to "chat_clarify".
    // This is a safety net independent of how well the model follows the prompt.
    if (result.intent === "add_expense") {
      const data = result.addExpenseData || {};
      const missingFields: string[] = [];

      const isGenericName = !data.name || data.name.trim() === "" ||
        ["transaction", "bill", "payment", "expense"].includes(data.name.toLowerCase().trim());

      if (isGenericName) missingFields.push("name of the bill");
      if (data.amount === undefined || data.amount === null || data.amount <= 0) missingFields.push("amount");
      if (!data.dayOfMonth || data.dayOfMonth < 1 || data.dayOfMonth > 31) missingFields.push("due day of the month");
      if (!data.billingCycle) missingFields.push("billing cycle (weekly, monthly, yearly, once)");

      if (missingFields.length > 0) {
        result.intent = "chat_clarify";
        result.replyMessage = `I can help you add your bill, but could you please specify the ${missingFields.join(", ")}?`;
      }
    }

    if (result.intent === "mark_paid") {
      const data = result.markPaidData || {};
      if (!data.paymentName && !data.paymentId) {
        result.intent = "chat_clarify";
        result.replyMessage = "I would love to help you log that transaction as paid! Which configured bill or payment are you paying?";
      }
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Agent assistant error:", error);
    res.status(500).json({ error: error.message || "Failed to process agent command" });
  }
}
