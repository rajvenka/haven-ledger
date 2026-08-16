import { Type } from "@google/genai";
import { generateContentWithFallback } from "./_gemini.js";

// Defense-in-depth: even though portfolioSummary is built by the frontend from an explicit
// field allowlist (symbol/quantity/price/currency/portfolio name only - portfolio_holdings
// has no credential columns at all), this scans it one more time before it's allowed anywhere
// near the Gemini prompt. Rejects the whole request rather than silently stripping - if this
// ever actually matches, something upstream already went wrong and should fail loudly, not
// quietly send a redacted version.
const CREDENTIAL_KEY_PATTERN = /api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|bearer|client[_-]?secret/i;
const LONG_TOKEN_LIKE_VALUE = /^[A-Za-z0-9_\-\.]{40,}$/; // typical shape of a real API key/token
function containsCredentialLikeData(value: any, path = ""): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    return LONG_TOKEN_LIKE_VALUE.test(value) ? `suspicious long token-like string at ${path || "(root)"}` : null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = containsCredentialLikeData(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (CREDENTIAL_KEY_PATTERN.test(key)) return `suspicious key name "${key}" at ${path || "(root)"}`;
      const hit = containsCredentialLikeData(value[key], path ? `${path}.${key}` : key);
      if (hit) return hit;
    }
  }
  return null;
}

// Precomputes P&L% per holding, groups by portfolio, and caps each portfolio to its top 8
// gainers + top 8 losers (pre-sorted, server-side) rather than sending every raw holding for
// the model to sort through itself. A workspace with 275 holdings across 'All' portfolios was
// the actual cause of requests timing out even at 45s - this keeps the prompt lean regardless
// of portfolio size, while still guaranteeing the genuine top/bottom performers are always
// included (since they're computed here, not left to the model to find).
function buildPortfolioContext(summary: any): string {
  if (!Array.isArray(summary) || summary.length === 0) return "(No portfolio holdings available)";
  const byPortfolio = new Map<string, any[]>();
  for (const h of summary) {
    const key = String(h?.portfolio || "Default");
    if (!byPortfolio.has(key)) byPortfolio.set(key, []);
    byPortfolio.get(key)!.push(h);
  }
  const lines: string[] = [];
  for (const [portfolio, holdings] of Array.from(byPortfolio.entries())) {
    const withPnl = holdings.map((h) => {
      const buy = Number(h?.buyPrice) || 0;
      const live = Number(h?.livePrice) || 0;
      const pnlPct = buy > 0 ? ((live - buy) / buy) * 100 : null;
      return { h, buy, live, pnlPct };
    });
    withPnl.sort((a, b) => (b.pnlPct ?? -Infinity) - (a.pnlPct ?? -Infinity));
    const CAP = 8;
    const top = withPnl.slice(0, CAP);
    const bottom = withPnl.length > CAP * 2 ? withPnl.slice(-CAP) : [];
    const shown = new Set([...top, ...bottom]);
    const omitted = withPnl.length - shown.size;

    lines.push(`  ${portfolio} (${withPnl.length} holdings total):`);
    for (const { h, buy, live, pnlPct } of top) {
      lines.push(`    - ${h?.symbol || "?"}: qty ${h?.quantity ?? "?"}, buy ${buy}, live ${live}, P&L ${pnlPct == null ? "n/a" : pnlPct.toFixed(2) + "%"}, ${h?.currency || ""}`);
    }
    if (bottom.length) {
      lines.push(`    (bottom performers)`);
      for (const { h, buy, live, pnlPct } of bottom) {
        lines.push(`    - ${h?.symbol || "?"}: qty ${h?.quantity ?? "?"}, buy ${buy}, live ${live}, P&L ${pnlPct == null ? "n/a" : pnlPct.toFixed(2) + "%"}, ${h?.currency || ""}`);
      }
    }
    if (omitted > 0) {
      lines.push(`    (+${omitted} more mid-range holdings not shown - only extremes listed above)`);
    }
  }
  return lines.join("\n");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { prompt, payments, history, userProfile, portfolioSummary, chatHistory } = req.body || {};

    if (!prompt) {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      return;
    }
    if (portfolioSummary != null) {
      const suspicious = containsCredentialLikeData(portfolioSummary, "portfolioSummary");
      if (suspicious) {
        console.error(`[Agent] Rejected request - ${suspicious}`);
        res.status(400).json({ error: "Portfolio data rejected by safety check - contact support." });
        return;
      }
    }

    const response = await generateContentWithFallback({
      contents: `
        You are the Haven Agent, an AI-powered financial assistant for a Bill and Expense Manager app called "Haven Vault", which also tracks investment portfolios.
        Your task is to interpret the user's comments or instructions.

        Context:
        - Current date/time: ${new Date().toISOString()}
        - Current configured payments: ${JSON.stringify(payments)}
        - User Profile: ${JSON.stringify(userProfile)}
        - Investment Portfolios (grouped by portfolio, with P&L% already computed - do not
          recompute or guess figures, just read and rank these):
        ${buildPortfolioContext(portfolioSummary)}
        - Recent Conversation History:
        ${chatHistory && Array.isArray(chatHistory) ? chatHistory.map((m: any) => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n') : '(None)'}
        - New User Input: "${prompt}"

        *** PORTFOLIO QUESTIONS (intent: "portfolio_query") ***
        If the user asks about their investments/portfolios/stocks - e.g. "what's my best
        performer", "how's ETORO RAJ doing", "who's up this week" - set intent to
        "portfolio_query".

        If the question doesn't say which portfolio/book they mean AND the data above covers
        more than one portfolio, don't combine everything into one answer - ask which
        portfolio they mean first, and list the actual portfolio names present in the data
        above so they can just reply with one (e.g. "Which one - Zerodha, ETORO RAJ, ETORO
        SASI, or STAKE AU?"). Exceptions: answer directly without asking if (a) only one
        portfolio actually exists in the data, (b) the question already names a specific
        portfolio, or (c) the question explicitly asks for something "overall", "combined",
        or "across everything".

        Once you know which portfolio, answer directly and specifically in replyMessage using
        ONLY the portfolio data given above (symbol, portfolio name, P&L%, currency). Name the
        actual symbol(s) and figures. If the portfolio data above is empty, say you don't see
        any holdings to analyze rather than guessing. Never fabricate a symbol, price, or
        percentage that isn't in the data given. This app distinguishes real cash committed
        from raw leveraged/CFD exposure for margin positions - if asked about "value" for a
        leveraged holding, prefer whichever figure is actually present in the data rather than
        assuming which one it is.

        If the answer involves comparing more than one holding (top gainers/losers, "how's
        this portfolio doing", etc.) - put the actual per-holding figures into the
        portfolioTable array (one row per holding, sorted by pnlPct descending), and keep
        replyMessage to a single short sentence introducing it (e.g. "Here are your top 5
        gainers in ETORO RAJ:"). Don't repeat the same list as prose text inside replyMessage
        too - the app renders portfolioTable as an actual table, so listing it twice is
        redundant. For a single-holding answer, just answer in replyMessage as normal and
        omit portfolioTable entirely.

        *** BILLS LISTING QUESTIONS ***
        If the answer lists multiple bills (e.g. "what's due next week", "show overdue
        bills") - put them into the billsTable array (one row per bill) instead of a bulleted
        list in replyMessage. Keep replyMessage to one short intro sentence (e.g. "You have 7
        bills coming up next week:"). Don't repeat the same list as prose bullets too - the
        app renders billsTable as an actual table. For a single-bill answer or a question that
        isn't really a listing, just answer in replyMessage as normal and omit billsTable.

        *** CRITICAL: FIELD VALUES MUST BE FINAL, CLEAN DATA — NEVER YOUR REASONING ***
        Every field in your JSON output (name, taggedFor, notes, category, etc.) must contain ONLY the final, clean value — a short name, a number, or null/omitted.
        NEVER write out your thought process, uncertainty, or deliberation as the content of a field (e.g. never write something like "or we can omit it but let's just..." as a field's value).
        If you are unsure whether a field applies, the correct action is to OMIT that field entirely or set it to null — not to describe your uncertainty inside the field itself.
        Every field value must be short (under 40 characters for names/tags) and read like real data a human typed, never like a sentence explaining a decision.
        The "amount" field must exactly match the dollar figure the user actually stated in their message (e.g. if they said "$444", amount must be 444 — never a placeholder, a rounded guess, or an unrelated number).

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
          "intent": "add_expense" | "add_bulk_expenses" | "mark_paid" | "update_expense" | "portfolio_query" | "chat_clarify",
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
            intent: { type: Type.STRING, description: "One of: 'add_expense', 'add_bulk_expenses', 'mark_paid', 'update_expense', 'portfolio_query', 'chat_clarify'" },
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
            portfolioTable: {
              type: Type.ARRAY,
              description: "For portfolio_query answers involving multiple holdings (e.g. 'top gainers', 'how's this portfolio doing') - one row per holding shown in replyMessage, so the app can render an actual table/chart. Omit entirely for single-holding or non-numeric answers.",
              items: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  portfolio: { type: Type.STRING },
                  pnlPct: { type: Type.NUMBER },
                  currency: { type: Type.STRING },
                },
              },
            },
            billsTable: {
              type: Type.ARRAY,
              description: "For answers listing multiple bills (e.g. 'what's due next week', 'show overdue bills') - one row per bill mentioned in replyMessage, so the app can render an actual table instead of a bulleted list. Omit entirely for single-bill or non-listing answers.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  currency: { type: Type.STRING },
                  dueDate: { type: Type.STRING, description: "e.g. 'Aug 17' - short, human-readable" },
                },
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
