const { ethers } = require("ethers");

/**
 * Helper to capitalize string.
 */
function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Ask Venice AI a question based on user transaction and budget data.
 * @param {string} question 
 * @param {Object} userData 
 * @returns {Promise<string>}
 */
async function askVenice(question, userData) {
  console.log(`\n[Venice AI Advisor] User Question: "${question}"`);

  const apiKey = process.env.VENICE_API_KEY;
  const model = process.env.VENICE_MODEL || "llama-3.3-70b";

  const budget = userData.budget || 0;
  const spent = userData.spent || 0;
  const remaining = budget - spent;
  const history = userData.history || [];

  const historyStr = history.map(tx => `- ${tx.timestamp || 'N/A'}: ${tx.merchant} - $${tx.amount} (${tx.status || 'success'})`).join('\n');

  const systemPrompt = `You are AutoPay Agent, a smart web3 subscription and budget advisor.
Analyze the user's spending data and answer their question.
Keep your answer very concise (1-3 sentences max).
Avoid generic advice. Focus on patterns in their history.

User Budget & Spending Status:
- Monthly Budget: $${budget}
- Total Spent: $${spent}
- Remaining Budget: $${remaining}

User Transaction History:
${historyStr || 'No transactions recorded yet.'}`;

  // If Venice API key is not configured, automatically fall back to local rule-based generation
  if (!apiKey) {
    console.warn(`[Venice AI Fallback] VENICE_API_KEY is not configured. Falling back to local rule-based insights.`);
    return generateFallbackInsight(question, userData);
  }

  try {
    const requestPayload = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.7
    };

    console.log(`\n================== [Venice AI API Request] ==================`);
    console.log(`URL: POST https://api.venice.ai/api/v1/chat/completions`);
    console.log(`Headers: { Authorization: "Bearer ${apiKey.substring(0, 8)}...", Content-Type: "application/json" }`);
    console.log(`Body:`, JSON.stringify(requestPayload, null, 2));
    console.log(`=============================================================\n`);

    const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });

    console.log(`\n================== [Venice AI API Response] ==================`);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error Payload:`, errorText);
      console.log(`==============================================================\n`);
      console.warn(`[Venice AI Fallback] API returned status ${response.status}. Falling back to local rule-based insights.`);
      return generateFallbackInsight(question, userData);
    }

    const data = await response.json();
    console.log(`Body:`, JSON.stringify(data, null, 2));
    console.log(`==============================================================\n`);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
    console.warn(`[Venice AI Fallback] Invalid response format. Falling back to local rule-based insights.`);
    return generateFallbackInsight(question, userData);
  } catch (err) {
    console.error("Error calling Venice AI:", err);
    console.warn(`[Venice AI Fallback] Connection failed. Falling back to local rule-based insights.`);
    return generateFallbackInsight(question, userData);
  }
}

/**
 * Parses natural language payments using Venice AI, with a regex fallback.
 * @param {string} text 
 * @returns {Promise<{merchant: string, amount: number}|null>}
 */
async function parseNaturalLanguagePayment(text) {
  const apiKey = process.env.VENICE_API_KEY;
  const model = process.env.VENICE_MODEL || "llama-3.3-70b";

  if (!apiKey) {
    console.warn("[Venice AI Fallback] VENICE_API_KEY is not set. Using local regex parser for text: \"" + text + "\"");
    return parseNaturalLanguagePaymentRegex(text);
  }

  try {
    const requestPayload = {
      model: model,
      messages: [
        {
          role: "system",
          content: `You are a precise data extractor. Extract the merchant name and numeric payment amount from natural language requests.
Reply ONLY with a raw JSON object and nothing else. Do not use markdown backticks, codeblocks, or any preamble.
The JSON must have keys: "merchant" (capitalized string) and "amount" (integer number).
If you cannot identify a clear merchant and amount, reply with: null`
        },
        { role: "user", content: text }
      ],
      temperature: 0.1
    };

    console.log(`\n================== [Venice AI Parse Payment Request] ==================`);
    console.log(`URL: POST https://api.venice.ai/api/v1/chat/completions`);
    console.log(`Headers: { Authorization: "Bearer ${apiKey.substring(0, 8)}...", Content-Type: "application/json" }`);
    console.log(`Body:`, JSON.stringify(requestPayload, null, 2));
    console.log(`=======================================================================\n`);

    const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });

    console.log(`\n================== [Venice AI Parse Payment Response] ==================`);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`Body:`, JSON.stringify(data, null, 2));
      console.log(`========================================================================\n`);

      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content.trim();
        // Clean potential JSON markdown wrapper
        const jsonStr = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        if (jsonStr !== "null") {
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed && parsed.merchant && typeof parsed.amount === "number") {
              return {
                merchant: capitalize(parsed.merchant),
                amount: Math.round(parsed.amount)
              };
            }
          } catch (e) {
            console.error("Failed to parse JSON from AI response:", content, e);
          }
        }
      }
    } else {
      const errorText = await response.text();
      console.error(`Error Payload:`, errorText);
      console.log(`========================================================================\n`);
    }
  } catch (err) {
    console.error("Error calling Venice AI for parsing:", err);
  }

  // Fall back to regex parser if API call fails or is null
  return parseNaturalLanguagePaymentRegex(text);
}

/**
 * Deterministic multi-pattern regex parser for natural language payment requests.
 * @param {string} text 
 * @returns {{merchant: string, amount: number}|null}
 */
function parseNaturalLanguagePaymentRegex(text) {
  const clean = text.toLowerCase().replace(/,/g, "").trim();
  let match;

  // "pay <merchant> $?<amount>"
  match = clean.match(/^pay\s+([a-z0-9_-]+)\s+\$?(\d+)/i);
  if (match) {
    return { merchant: capitalize(match[1]), amount: parseInt(match[2], 10) };
  }

  // "send \$?<amount>\s+to\s+([a-z0-9_-]+)"
  match = clean.match(/^send\s+\$?(\d+)\s+to\s+([a-z0-9_-]+)/i);
  if (match) {
    return { merchant: capitalize(match[2]), amount: parseInt(match[1], 10) };
  }

  // "pay \$?<amount>\s+to\s+([a-z0-9_-]+)"
  match = clean.match(/^pay\s+\$?(\d+)\s+to\s+([a-z0-9_-]+)/i);
  if (match) {
    return { merchant: capitalize(match[2]), amount: parseInt(match[1], 10) };
  }

  // "send\s+([a-z0-9_-]+)\s+\$?(\d+)"
  match = clean.match(/^send\s+([a-z0-9_-]+)\s+\$?(\d+)/i);
  if (match) {
    return { merchant: capitalize(match[1]), amount: parseInt(match[2], 10) };
  }

  return null;
}

/**
 * Local rule-based fallback to generate spending insights without Venice API.
 */
function generateFallbackInsight(question, userData) {
  const budget = userData.budget || 0;
  const spent = userData.spent || 0;
  const remaining = budget - spent;
  const history = userData.history || [];

  const q = question.toLowerCase();

  // If question is about budget being exceeded
  if (q.includes("exceed") || q.includes("over") || q.includes("limit") || q.includes("why")) {
    if (spent > budget) {
      const subscriptionSpent = history
        .filter(tx => ["netflix", "spotify", "canva", "openai", "claude"].includes(tx.merchant.toLowerCase()))
        .reduce((sum, tx) => sum + tx.amount, 0);
      const subPercent = spent > 0 ? Math.round((subscriptionSpent / spent) * 100) : 0;
      
      if (subPercent > 50) {
        return `You exceeded your budget because ${subPercent}% of spending ($${subscriptionSpent}) was directed toward subscription payments like Netflix, Spotify, Canva, OpenAI, or Claude.`;
      }
      return `You exceeded your monthly budget of $${budget} because your total spending reached $${spent}. Try adjusting your policy limit using the /policy command.`;
    } else {
      return `Your budget is not currently exceeded. You have $${remaining} remaining out of your $${budget} budget.`;
    }
  }

  // Generic advisor fallback
  if (history.length === 0) {
    return "You have no transaction history yet. Set a budget with /policy and start making payments to get spending advice.";
  }

  // Calculate top categories / merchants
  const spends = {};
  history.forEach(tx => {
    spends[tx.merchant] = (spends[tx.merchant] || 0) + tx.amount;
  });
  let topM = "None";
  let maxSpend = 0;
  for (const m in spends) {
    if (spends[m] > maxSpend) {
      maxSpend = spends[m];
      topM = m;
    }
  }

  const percentageUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  return `Based on your history, your largest spending is at ${capitalize(topM)} with a total of $${maxSpend}. You have utilized ${percentageUsed}% of your $${budget} budget.`;
}

module.exports = {
  askVenice,
  parseNaturalLanguagePayment,
  generateFallbackInsight
};
