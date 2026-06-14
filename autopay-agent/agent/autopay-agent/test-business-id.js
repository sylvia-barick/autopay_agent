const fetch = require('node-fetch');

async function testBusinessId() {
  const credentials = {
    clientId: "8EupfD+JpLdJnB3En4xZkSvufZVtt/oR",
    clientSecret: "TQJzuSjsq41ljRIn6yxaS2Hryl+HNbdJ",
    businessId: "7caee559-241e-4bbb-913c-e4bb4a91aead"
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

    console.log(`2. Querying methods list for business: ${credentials.businessId}`);
    const listRes = await fetch(`https://api.1shotapi.com/v0/business/${credentials.businessId}/methods`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });

    console.log(`Methods Status: ${listRes.status}`);
    console.log(`Methods response: ${await listRes.text()}`);

    console.log(`3. Querying wallets list for business: ${credentials.businessId}`);
    const walletsRes = await fetch(`https://api.1shotapi.com/v0/business/${credentials.businessId}/wallets`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });

    console.log(`Wallets Status: ${walletsRes.status}`);
    console.log(`Wallets response: ${await walletsRes.text()}`);

  } catch (err) {
    console.error("Error testing business ID:", err);
  }
}

testBusinessId();
