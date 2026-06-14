const fetch = require('node-fetch');

async function createWallet() {
  const credentials = {
    clientId: "8EupfD+JpLdJnB3En4xZkSvufZVtt/oR",
    clientSecret: "TQJzuSjsq41ljRIn6yxaS2Hryl+HNbdJ",
    businessId: "c237dd76-7141-482b-9ff1-7606dba28fd7"
  };

  try {
    console.log("1. Fetching token...");
    const tokenRes = await fetch("https://api.1shotapi.com/v0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      })
    });
    
    if (!tokenRes.ok) {
      throw new Error(`Token request failed: ${tokenRes.status} - ${await tokenRes.text()}`);
    }

    const { access_token } = await tokenRes.json();
    console.log("Token obtained successfully.");

    console.log("2. Creating managed wallet...");
    const walletRes = await fetch(`https://api.1shotapi.com/v0/business/${credentials.businessId}/wallets`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chainId: 11155111,
        name: "AutoPay Managed Wallet",
        description: "Wallet to sign gasless subscription executions"
      })
    });

    console.log(`Status: ${walletRes.status}`);
    console.log(`Response: ${await walletRes.text()}`);

  } catch (err) {
    console.error("Error creating wallet:", err);
  }
}

createWallet();
