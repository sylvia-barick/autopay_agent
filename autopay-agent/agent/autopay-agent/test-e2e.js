const fetch = require('node-fetch');
const fs = require('fs');

async function runE2E() {
  console.log("=== Starting End-to-End 1Shot Test ===");

  // 1. Ensure user is registered with budget and pending payment
  const userData = [
    {
      telegramId: "1198997650",
      walletAddress: "0x9653e506206a806381c0492a6c90878f2e605b42",
      balance: "0.0103 ETH",
      budget: 200,
      spent: 0,
      history: [],
      pendingTx: {
        merchant: "Netflix",
        amount: 5,
        status: "pending_meta_mask"
      }
    }
  ];

  fs.writeFileSync('./data/users.json', JSON.stringify(userData, null, 2));
  console.log("Database seeded with user 1198997650 and pending Netflix $5 transaction.");

  // 2. Execute the payment using our 1Shot endpoint
  console.log("\nTriggering payment execution on backend server...");
  try {
    const res = await fetch("http://localhost:5000/execute-1shot-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        telegramId: "1198997650",
        merchant: "Netflix",
        amount: 5
      })
    });

    console.log(`Response Status: ${res.status}`);
    const data = await res.json();
    console.log("Response Data:", JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("E2E Test Failed:", err);
  }
}

runE2E();
