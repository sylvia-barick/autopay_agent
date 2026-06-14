const fetch = require('node-fetch');

async function listWallets() {
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

    console.log("2. Querying wallets list for business...");
    const listRes = await fetch(`https://api.1shotapi.com/v0/business/${credentials.businessId}/wallets`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });

    console.log(`Status: ${listRes.status}`);
    const text = await listRes.text();
    console.log(`Wallets response:\n${text}`);

  } catch (err) {
    console.error("Error listing wallets:", err);
  }
}

listWallets();
