const fetch = require('node-fetch');

async function inspectId() {
  const credentials = {
    clientId: "8EupfD+JpLdJnB3En4xZkSvufZVtt/oR",
    clientSecret: "TQJzuSjsq41ljRIn6yxaS2Hryl+HNbdJ",
    targetId: "7caee559-241e-4bbb-913c-e4bb4a91aead"
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

    console.log(`2. Inspecting as contractMethod: GET /methods/${credentials.targetId}`);
    const methodRes = await fetch(`https://api.1shotapi.com/v0/methods/${credentials.targetId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });
    console.log(`Status: ${methodRes.status}`);
    console.log(`Response: ${await methodRes.text()}`);

    console.log(`3. Inspecting as wallet: GET /wallets/${credentials.targetId}`);
    const walletRes = await fetch(`https://api.1shotapi.com/v0/wallets/${credentials.targetId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });
    console.log(`Status: ${walletRes.status}`);
    console.log(`Response: ${await walletRes.text()}`);

  } catch (err) {
    console.error("Error inspecting ID:", err);
  }
}

inspectId();
