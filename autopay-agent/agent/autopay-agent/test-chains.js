const fetch = require('node-fetch');

async function getChains() {
  const credentials = {
    clientId: "8EupfD+JpLdJnB3En4xZkSvufZVtt/oR",
    clientSecret: "TQJzuSjsq41ljRIn6yxaS2Hryl+HNbdJ"
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

    console.log("2. Querying supported chains...");
    const chainsRes = await fetch("https://api.1shotapi.com/v0/chains", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });

    console.log(`Status: ${chainsRes.status}`);
    console.log(`Response: ${await chainsRes.text()}`);

  } catch (err) {
    console.error("Error getting chains:", err);
  }
}

getChains();
