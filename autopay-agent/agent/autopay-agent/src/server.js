const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { executeOneShotTransaction } = require("./services/oneShotService");

const app = express();

app.use(cors());
app.use(express.json());

app.post("/link-wallet", (req, res) => {
    console.log("POST /link-wallet received:", req.body);
    const { telegramId, walletAddress, balance } = req.body;

    let users = [];

    if (fs.existsSync("./data/users.json")) {
        users = JSON.parse(
            fs.readFileSync("./data/users.json")
        );
    }

    const userIndex = users.findIndex(u => u.telegramId === telegramId);
    if (userIndex !== -1) {
        users[userIndex].walletAddress = walletAddress;
        users[userIndex].balance = balance || "0.0000 ETH";
        if (users[userIndex].budget === undefined) users[userIndex].budget = 0;
        if (users[userIndex].spent === undefined) users[userIndex].spent = 0;
        if (users[userIndex].history === undefined) users[userIndex].history = [];
    } else {
        users.push({
            telegramId,
            walletAddress,
            balance: balance || "0.0000 ETH",
            budget: 0,
            spent: 0,
            history: [],
        });
    }

    fs.writeFileSync(
        "./data/users.json",
        JSON.stringify(users, null, 2)
    );

    res.json({
        success: true,
    });
});

app.get("/dashboard/:telegramId", (req, res) => {
    const { telegramId } = req.params;
    let users = [];

    if (fs.existsSync("./data/users.json")) {
        users = JSON.parse(
            fs.readFileSync("./data/users.json")
        );
    }

    const user = users.find(u => u.telegramId === telegramId);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const budget = user.budget !== undefined ? user.budget : 0;
    const spent = user.spent !== undefined ? user.spent : 0;
    const remaining = budget - spent;
    const history = user.history || [];

    // Calculate advanced analytics
    const totalTransactions = history.length;
    let largestTransaction = 0;
    let topMerchant = "None";
    let topMerchantSpend = 0;
    let topMerchantCount = 0;
    let mostUsedMerchant = "None";
    let mostUsedCount = 0;

    const merchantSpends = {};
    const merchantCounts = {};

    history.forEach(tx => {
        const amt = tx.amount || 0;
        const merch = tx.merchant || "Unknown";
        if (amt > largestTransaction) {
            largestTransaction = amt;
        }
        merchantSpends[merch] = (merchantSpends[merch] || 0) + amt;
        merchantCounts[merch] = (merchantCounts[merch] || 0) + 1;
    });

    for (const m in merchantSpends) {
        if (merchantSpends[m] > topMerchantSpend) {
            topMerchantSpend = merchantSpends[m];
            topMerchant = m;
        }
    }

    for (const m in merchantCounts) {
        if (merchantCounts[m] > mostUsedCount) {
            mostUsedCount = merchantCounts[m];
            mostUsedMerchant = m;
        }
    }

    if (topMerchant !== "None") {
        topMerchantCount = merchantCounts[topMerchant] || 0;
    }

    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const displayTopMerchant = topMerchant !== "None" ? capitalize(topMerchant) : "None";
    const displayMostUsedMerchant = mostUsedMerchant !== "None" ? capitalize(mostUsedMerchant) : "None";

    const budgetUsagePercent = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    const averageTransactionAmount = totalTransactions > 0 ? (spent / totalTransactions).toFixed(2) : "0.00";

    res.json({
        walletAddress: user.walletAddress || "",
        balance: user.balance || "0.0000 ETH",
        budget,
        spent,
        remaining,
        transactions: history,
        pendingTx: user.pendingTx || null,
        // Advanced analytics fields
        topMerchant: displayTopMerchant,
        topMerchantCount,
        largestTransaction,
        totalTransactions,
        mostUsedMerchant: displayMostUsedMerchant,
        averageTransactionAmount,
        budgetUsagePercent
    });
});

app.post("/dashboard/:telegramId/ask", async (req, res) => {
    const { telegramId } = req.params;
    const { question } = req.body;
    let users = [];

    if (fs.existsSync("./data/users.json")) {
        users = JSON.parse(
            fs.readFileSync("./data/users.json")
        );
    }

    const user = users.find(u => u.telegramId === telegramId);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const { askVenice } = require("./services/aiService");
    try {
        const answer = await askVenice(question, user);
        res.json({ answer });
    } catch (err) {
        console.error("Error running ask Venice:", err);
        res.status(500).json({ error: "Failed to generate AI insights." });
    }
});

app.post("/execute-payment", (req, res) => {
    console.log("POST /execute-payment received:", req.body);
    const { telegramId, txHash, merchant, amount } = req.body;
    let users = [];

    if (fs.existsSync("./data/users.json")) {
        users = JSON.parse(
            fs.readFileSync("./data/users.json")
        );
    }

    const userIndex = users.findIndex(u => u.telegramId === String(telegramId));
    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
    }

    const user = users[userIndex];
    const budget = user.budget || 0;
    const spent = user.spent || 0;
    const remaining = budget - spent;
    const numericAmount = Number(amount);

    if (numericAmount > remaining) {
        console.warn(`[Blocked Transaction] User ${telegramId} attempted execution of $${numericAmount} exceeding remaining budget of $${remaining}`);
        return res.status(400).json({ error: `Insufficient budget. Remaining: $${remaining}, Requested: $${numericAmount}` });
    }

    user.spent = (user.spent || 0) + numericAmount;
    
    if (!user.history) {
        user.history = [];
    }
    user.history.push({
        merchant,
        amount: numericAmount,
        txHash,
        timestamp: new Date().toISOString(),
        status: "success",
        method: "MetaMask"
    });

    // Clear pending transaction
    user.pendingTx = null;

    fs.writeFileSync(
        "./data/users.json",
        JSON.stringify(users, null, 2)
    );

    // Send Telegram Notification
    const bot = getBot();
    if (bot) {
        bot.telegram.sendMessage(
            telegramId,
            `✅ Payment Executed (via MetaMask)\n\nMerchant: ${merchant}\nAmount: $${numericAmount}\nTransaction Hash:\n${txHash}\n\nView on Etherscan:\nhttps://sepolia.etherscan.io/tx/${txHash}`
        ).catch(err => console.error("Error sending bot message:", err));
    }

    res.json({ success: true });
});

app.post("/execute-1shot-payment", async (req, res) => {
    console.log("POST /execute-1shot-payment received:", req.body);
    const { telegramId, merchant, amount } = req.body;
    let users = [];

    if (fs.existsSync("./data/users.json")) {
        users = JSON.parse(
            fs.readFileSync("./data/users.json")
        );
    }

    const userIndex = users.findIndex(u => u.telegramId === String(telegramId));
    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
    }

    const user = users[userIndex];
    const budget = user.budget || 0;
    const spent = user.spent || 0;
    const remaining = budget - spent;
    const numericAmount = Number(amount);

    if (numericAmount > remaining) {
        console.warn(`[Blocked Transaction] User ${telegramId} attempted execution of $${numericAmount} exceeding remaining budget of $${remaining}`);
        return res.status(400).json({ error: `Insufficient budget. Remaining: $${remaining}, Requested: $${numericAmount}` });
    }

    try {
        // Execute the payment via 1Shot Relayer
        const result = await executeOneShotTransaction(merchant, numericAmount, user.walletAddress);

        user.spent = (user.spent || 0) + numericAmount;
        
        if (!user.history) {
            user.history = [];
        }
        user.history.push({
            merchant,
            amount: numericAmount,
            txHash: result.txHash,
            timestamp: new Date().toISOString(),
            status: "success",
            method: "1Shot API"
        });

        // Clear pending transaction
        user.pendingTx = null;

        fs.writeFileSync(
            "./data/users.json",
            JSON.stringify(users, null, 2)
        );

        // Send Telegram Notification
        const bot = getBot();
        if (bot) {
            bot.telegram.sendMessage(
                telegramId,
                `⚡ Payment Executed (via 1Shot Gasless Relayer)\n\nMerchant: ${merchant}\nAmount: $${numericAmount}\nTransaction Hash:\n${result.txHash}\n\nView on Etherscan:\nhttps://sepolia.etherscan.io/tx/${result.txHash}`
            ).catch(err => console.error("Error sending bot message:", err));
        }

        res.json({ success: true, txHash: result.txHash });
    } catch (err) {
        console.error("1Shot execution error:", err);
        res.status(500).json({ error: `1Shot Relayer failed: ${err.message}` });
    }
});

app.post("/reject-payment", (req, res) => {
    console.log("POST /reject-payment received:", req.body);
    const { telegramId } = req.body;
    let users = [];

    if (fs.existsSync("./data/users.json")) {
        users = JSON.parse(
            fs.readFileSync("./data/users.json")
        );
    }

    const userIndex = users.findIndex(u => u.telegramId === telegramId);
    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
    }

    const user = users[userIndex];
    user.pendingTx = null;

    fs.writeFileSync(
        "./data/users.json",
        JSON.stringify(users, null, 2)
    );

    // Send Telegram Notification
    const bot = getBot();
    if (bot) {
        bot.telegram.sendMessage(
            telegramId,
            `❌ MetaMask Transaction Rejected via Web Dashboard`
        ).catch(err => console.error("Error sending bot message:", err));
    }

    res.json({ success: true });
});

let botInstance = null;

function registerBot(bot) {
    botInstance = bot;
}

function getBot() {
    return botInstance;
}

app.listen(5000, () => {
    console.log("API running on 5000");
});

module.exports = {
    registerBot,
    getBot
};