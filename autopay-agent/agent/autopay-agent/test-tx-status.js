const fetch = require('node-fetch');

async function checkStatus() {
  const credentials = {
    clientId: "8EupfD+JpLdJnB3En4xZkSvufZVtt/oR",
    clientSecret: "TQJzuSjsq41ljRIn6yxaS2Hryl+HNbdJ",
    txId: "81ab728f-27f3-4a87-9612-7e1b1038e59e"
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

    console.log(`2. Querying transaction status: GET /transactions/${credentials.txId}`);
    const statusRes = await fetch(`https://api.1shotapi.com/v0/transactions/${credentials.txId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });

    console.log(`Status: ${statusRes.status}`);
    const text = await statusRes.text();
    console.log(`Transaction response:\n${text}`);

  } catch (err) {
    console.error("Error checking status:", err);
  }
}

checkStatus();
