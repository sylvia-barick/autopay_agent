require("dotenv").config();
const { registerBot } = require("./server");

const { Telegraf } = require("telegraf");
const { generateWallet } = require("./wallet/walletService");

const bot = new Telegraf(process.env.BOT_TOKEN);
registerBot(bot);

function getUser(telegramId) {
  const fs = require("fs");
  try {
    if (fs.existsSync("./data/users.json")) {
      const users = JSON.parse(fs.readFileSync("./data/users.json"));
      return users.find((u) => u.telegramId === String(telegramId));
    }
  } catch (err) {
    console.error("Error reading users.json:", err);
  }
  return null;
}

function updateUser(telegramId, fields) {
  const fs = require("fs");
  try {
    let users = [];
    if (fs.existsSync("./data/users.json")) {
      users = JSON.parse(fs.readFileSync("./data/users.json"));
    }
    const userIndex = users.findIndex((u) => u.telegramId === String(telegramId));
    let updatedUser;
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...fields };
      updatedUser = users[userIndex];
    } else {
      updatedUser = {
        telegramId: String(telegramId),
        walletAddress: "",
        balance: "0.0000 ETH",
        budget: 0,
        spent: 0,
        history: [],
        ...fields
      };
      users.push(updatedUser);
    }
    fs.writeFileSync("./data/users.json", JSON.stringify(users, null, 2));
    return updatedUser;
  } catch (err) {
    console.error("Error updating users.json:", err);
  }
  return null;
}

function getPendingPayment(telegramId) {
  const fs = require("fs");
  try {
    if (fs.existsSync("./data/pending_payments.json")) {
      const data = JSON.parse(fs.readFileSync("./data/pending_payments.json"));
      return data[String(telegramId)] || null;
    }
  } catch (err) {
    console.error("Error reading pending_payments.json:", err);
  }
  return null;
}

function setPendingPayment(telegramId, payment) {
  const fs = require("fs");
  try {
    let data = {};
    if (fs.existsSync("./data/pending_payments.json")) {
      data = JSON.parse(fs.readFileSync("./data/pending_payments.json"));
    }
    if (payment === null) {
      delete data[String(telegramId)];
    } else {
      data[String(telegramId)] = payment;
    }
    fs.writeFileSync("./data/pending_payments.json", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing pending_payments.json:", err);
  }
}

bot.start((ctx) => {
  const user = getUser(ctx.from.id);
  const userBudget = user && user.budget !== undefined ? user.budget : 0;
  const userSpent = user && user.spent !== undefined ? user.spent : 0;
  const userRemaining = userBudget - userSpent;
  if (user && user.walletAddress) {
    ctx.reply(
      ` Welcome to AutoPay Agent\n\nWallet: Connected\nAddress: ${user.walletAddress}\nBalance: ${user.balance || "0.0000 ETH"}\nBudget: $${userBudget}\nSpent: $${userSpent}\nRemaining: $${userRemaining}`
    );
  } else {
    ctx.reply(
      ` Welcome to AutoPay Agent\n\nWallet: Not Connected\nBudget: Not Set\n\nYour Telegram User ID is: ${ctx.from.id}\nCopy this ID and input it in the frontend, then connect MetaMask to link your wallet.`
    );
  }
});

bot.command("status", (ctx) => {
  const user = getUser(ctx.from.id);
  const userBudget = user && user.budget !== undefined ? user.budget : 0;
  const userSpent = user && user.spent !== undefined ? user.spent : 0;
  const remaining = userBudget - userSpent;

  ctx.reply(
    `Budget: ${userBudget}\nSpent: ${userSpent}\nRemaining: ${remaining}`
  );
});

bot.command("help", (ctx) => {
  ctx.reply(
    "Available Commands\n\n/start\n/status\n/help\n/policy\n/spend\n/pay\n/approve\n/reject\n/wallet\n/balance\n/history\n/insights\n/advisor\n/ask\n/analytics"
  );
});

bot.command("policy", (ctx) => {
  const parts = ctx.message.text.split(" ");
  const amount = parseInt(parts[1], 10);

  if (isNaN(amount) || amount < 0) {
    return ctx.reply("Usage: /policy 100");
  }

  const tgId = String(ctx.from.id);
  const user = getUser(tgId) || { spent: 0 };
  const spent = user.spent || 0;
  if (amount < spent) {
    return ctx.reply(`❌ Cannot set budget to $${amount} because you have already spent $${spent} this month.`);
  }

  updateUser(tgId, { budget: amount });
  ctx.reply(`✅ Monthly budget set to $${amount}`);
});

bot.command("spend", (ctx) => {
  const parts = ctx.message.text.split(" ");
  const amount = parseInt(parts[1], 10);

  if (isNaN(amount) || amount < 0) {
    return ctx.reply("Usage: /spend 20");
  }

  const tgId = String(ctx.from.id);
  const user = getUser(tgId) || { budget: 0, spent: 0, history: [] };
  const budget = user.budget || 0;
  const spent = user.spent || 0;
  const remaining = budget - spent;

  if (amount > remaining) {
    return ctx.reply(
      `❌ Spending Exceeds Remaining Budget\n\nRemaining: $${remaining}\nRequested: $${amount}`
    );
  }

  const newSpent = spent + amount;
  const history = user.history || [];
  history.push({ merchant: "Manual Spend", amount: amount, timestamp: new Date().toISOString(), status: "success" });

  const updatedUser = updateUser(tgId, { spent: newSpent, history });
  const updatedRemaining = (updatedUser.budget || 0) - updatedUser.spent;

  ctx.reply(
    `✅ Recorded spending\n\nSpent: $${updatedUser.spent}\nRemaining: $${updatedRemaining}`
  );
});

bot.command("pay", (ctx) => {
  const parts = ctx.message.text.split(" ");
  const merchant = parts[1];
  const amount = parseInt(parts[2], 10);

  if (!merchant || isNaN(amount) || amount <= 0) {
    return ctx.reply("Usage: /pay Netflix 15");
  }

  const tgId = String(ctx.from.id);
  const user = getUser(tgId) || { budget: 0, spent: 0 };
  const budget = user.budget || 0;
  const spent = user.spent || 0;
  const remaining = budget - spent;

  if (budget === 0) {
    return ctx.reply("Please set a budget first using /policy <amount>");
  }

  if (amount > remaining) {
    return ctx.reply(
      `❌ Budget Limit Exceeded\n\nRemaining: $${remaining}\nRequested: $${amount}`
    );
  }

  setPendingPayment(tgId, { merchant, amount });

  ctx.reply(
    `${merchant} requests payment of $${amount}\n\nApprove?\n\n/approve\n/reject`
  );
});

bot.command("approve", (ctx) => {
  const tgId = String(ctx.from.id);
  const pending = getPendingPayment(tgId);

  if (!pending) {
    return ctx.reply("No pending payment request to approve.");
  }

  const user = getUser(tgId) || { budget: 0, spent: 0 };
  const budget = user.budget || 0;
  const spent = user.spent || 0;
  const remaining = budget - spent;

  if (pending.amount > remaining) {
    // Clear pending payments list since it is invalid now
    setPendingPayment(tgId, null);
    return ctx.reply(
      `❌ Budget Limit Exceeded\n\nRemaining: $${remaining}\nRequested: $${pending.amount}`
    );
  }

  // Create pending transaction request instead of immediately executing
  updateUser(tgId, {
    pendingTx: {
      merchant: pending.merchant,
      amount: pending.amount,
      status: "pending_meta_mask"
    }
  });

  // Clear pending payments list
  setPendingPayment(tgId, null);

  ctx.reply(
    `Transaction request generated.\n\nMerchant: ${pending.merchant}\nAmount: $${pending.amount}\n\nPlease visit the Web Dashboard and sign the MetaMask transaction to execute the payment.`
  );
});

bot.command("reject", (ctx) => {
  const tgId = String(ctx.from.id);
  const pending = getPendingPayment(tgId);

  if (pending) {
    setPendingPayment(tgId, null);
    return ctx.reply("❌ Payment Rejected");
  }

  // Clear MetaMask pending transaction if there is one
  const user = getUser(tgId);
  if (user && user.pendingTx) {
    updateUser(tgId, { pendingTx: null });
    return ctx.reply("❌ MetaMask Transaction Rejected");
  }

  ctx.reply("No pending payment request to reject.");
});

bot.command("history", (ctx) => {
  const user = getUser(ctx.from.id);
  if (!user || !user.history || user.history.length === 0) {
    return ctx.reply("No transaction history found.\n\nTotal Spent: $0");
  }

  let lines = user.history.map((tx) => `${tx.merchant} - $${tx.amount}`).join("\n");
  const total = user.spent || 0;

  ctx.reply(`${lines}\n\nTotal Spent: $${total}`);
});

bot.command("wallet", (ctx) => {
  const user = getUser(ctx.from.id);

  if (!user) {
    return ctx.reply(`No wallet linked.\n\nYour Telegram User ID is: ${ctx.from.id}\nCopy this ID and input it in the frontend, then connect MetaMask to link your wallet.`);
  }

  ctx.reply(
    `Wallet Linked\n\nAddress: ${user.walletAddress}\nBalance: ${user.balance || "0.0000 ETH"}`
  );
});

bot.command("balance", (ctx) => {
  const user = getUser(ctx.from.id);

  if (!user) {
    return ctx.reply(`No wallet linked.\n\nYour Telegram User ID is: ${ctx.from.id}\nCopy this ID and input it in the frontend, then connect MetaMask to link your wallet.`);
  }

  ctx.reply(
    `💰 Wallet Balance\n\nBalance: ${user.balance || "0.0000 ETH"}`
  );
});

bot.command("insights", (ctx) => {
  const tgId = String(ctx.from.id);
  const user = getUser(tgId);
  
  const budget = user && user.budget !== undefined ? user.budget : 0;
  const spent = user && user.spent !== undefined ? user.spent : 0;
  const remaining = budget - spent;
  const history = (user && user.history) || [];

  // Calculate analytics
  let topMerchant = "None";
  let topMerchantSpend = 0;
  let topMerchantCount = 0;
  let largestPayment = 0;
  let mostUsedMerchant = "None";
  let mostUsedCount = 0;

  const merchantSpends = {};
  const merchantCounts = {};

  history.forEach((tx) => {
    const amt = tx.amount || 0;
    const merch = tx.merchant || "Unknown";
    
    merchantSpends[merch] = (merchantSpends[merch] || 0) + amt;
    merchantCounts[merch] = (merchantCounts[merch] || 0) + 1;

    if (amt > largestPayment) {
      largestPayment = amt;
    }
  });

  // Find Top Merchant (highest total spend amount)
  for (const m in merchantSpends) {
    if (merchantSpends[m] > topMerchantSpend) {
      topMerchantSpend = merchantSpends[m];
      topMerchant = m;
    }
  }

  // Find Most Used Merchant (highest count)
  for (const m in merchantCounts) {
    if (merchantCounts[m] > mostUsedCount) {
      mostUsedCount = merchantCounts[m];
      mostUsedMerchant = m;
    }
  }

  // If there's a top merchant, get its transaction count
  if (topMerchant !== "None") {
    topMerchantCount = merchantCounts[topMerchant] || 0;
  }

  // Capitalize merchant names for presentation
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const displayTopMerchant = topMerchant !== "None" ? capitalize(topMerchant) : "None";
  const displayMostUsedMerchant = mostUsedMerchant !== "None" ? capitalize(mostUsedMerchant) : "None";

  ctx.reply(
    `💡 Spending Insights\n\nBudget: $${budget}\nSpent: $${spent}\nRemaining: $${remaining}\n\nTop Merchant: ${displayTopMerchant}\nTransactions: ${topMerchantCount}\n\nLargest Payment: $${largestPayment}\n\nMost Used Merchant: ${displayMostUsedMerchant}`
  );
});

bot.command("advisor", (ctx) => {
  const parts = ctx.message.text.split(" ");
  const amount = parseInt(parts[1], 10);

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply("Usage: /advisor 50");
  }

  const tgId = String(ctx.from.id);
  const user = getUser(tgId) || { budget: 0, spent: 0 };
  const budget = user.budget || 0;
  const spent = user.spent || 0;
  const remaining = budget - spent;

  const approved = amount <= remaining;
  const recommendation = approved ? "Approved ✅" : "Rejected ❌";

  ctx.reply(
    `Requested Amount: $${amount}\n\nRemaining Budget: $${remaining}\n\nRecommendation:\n${recommendation}`
  );
});

bot.command("ask", async (ctx) => {
  const text = ctx.message.text.trim();
  const parts = text.split(" ");
  const question = parts.slice(1).join(" ");

  if (!question) {
    return ctx.reply("Usage: /ask Why was my budget exceeded?");
  }

  const tgId = String(ctx.from.id);
  const user = getUser(tgId);

  if (!user) {
    return ctx.reply("No user account found. Please link your wallet via the web dashboard.");
  }

  ctx.reply("🤖 Analyzing with Venice AI...");
  ctx.sendChatAction("typing").catch(err => console.error("Error sending typing action:", err));

  const { askVenice } = require("./services/aiService");
  const response = await askVenice(question, user);

  ctx.reply(response);
});

bot.command("analytics", (ctx) => {
  const tgId = String(ctx.from.id);
  const user = getUser(tgId);

  const budget = user && user.budget !== undefined ? user.budget : 0;
  const spent = user && user.spent !== undefined ? user.spent : 0;
  const history = (user && user.history) || [];

  const totalTransactions = history.length;
  const averageTransactionAmount = totalTransactions > 0 ? (spent / totalTransactions).toFixed(2) : "0.00";
  
  let largestTransaction = 0;
  let mostFrequentMerchant = "None";
  let maxCount = 0;

  const merchantCounts = {};
  history.forEach((tx) => {
    const amt = tx.amount || 0;
    const merch = tx.merchant || "Unknown";
    if (amt > largestTransaction) {
      largestTransaction = amt;
    }
    merchantCounts[merch] = (merchantCounts[merch] || 0) + 1;
  });

  for (const m in merchantCounts) {
    if (merchantCounts[m] > maxCount) {
      maxCount = merchantCounts[m];
      mostFrequentMerchant = m;
    }
  }

  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const displayFrequentMerchant = mostFrequentMerchant !== "None" ? capitalize(mostFrequentMerchant) : "None";

  const budgetUsagePercent = budget > 0 ? ((spent / budget) * 100).toFixed(1) : "0.0";

  ctx.reply(
    `📊 Transaction Analytics\n\nTotal Transactions: ${totalTransactions}\nAverage Transaction Amount: $${averageTransactionAmount}\nMost Frequent Merchant: ${displayFrequentMerchant}\nLargest Transaction: $${largestTransaction}\nCurrent Budget Usage: ${budgetUsagePercent}%`
  );
});

// Natural Language Payments Message Listener
bot.on("text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) {
    return next();
  }

  const tgId = String(ctx.from.id);
  const { parseNaturalLanguagePayment } = require("./services/aiService");

  // Show typing action while parsing
  ctx.sendChatAction("typing").catch(err => console.error("Error sending typing action:", err));

  // Try Venice AI or regex fallback
  const payment = await parseNaturalLanguagePayment(text);

  if (payment && payment.merchant && payment.amount > 0) {
    const { merchant, amount } = payment;
    const user = getUser(tgId) || { budget: 0, spent: 0 };
    const budget = user.budget || 0;
    const spent = user.spent || 0;
    const remaining = budget - spent;

    if (budget === 0) {
      return ctx.reply("Please set a budget first using /policy <amount>");
    }

    if (amount > remaining) {
      return ctx.reply(
        `❌ Budget Limit Exceeded\n\nRemaining: $${remaining}\nRequested: $${amount}`
      );
    }

    setPendingPayment(tgId, { merchant, amount });

    return ctx.reply(
      `${merchant} requests payment of $${amount}\n\nApprove?\n\n/approve\n/reject`
    );
  } else {
    // Helpful guide fallback
    return ctx.reply(
      `I couldn't understand that command. Did you mean to make a payment?\n\nTry:\n👉 Pay Netflix $20\n👉 Send $20 to Netflix\n\nOr use /help to see other commands.`
    );
  }
});

bot.launch().catch(err => {
  console.error("Failed to launch Telegram bot:", err.message);
  console.log("Express API server will continue running on port 5000.");
});

console.log(" Bot Running...");