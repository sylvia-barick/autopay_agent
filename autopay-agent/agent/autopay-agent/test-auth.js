const fetch = require('node-fetch'); // wait, let's check node version or use native fetch if supported (Node 18+ has native fetch)

async function tryAuth(clientId, clientSecret, label) {
  console.log(`\nTesting auth for [${label}]...`);
  console.log(`Client ID: ${clientId}`);
  console.log(`Client Secret: ${clientSecret}`);
  try {
    const res = await fetch("https://api.1shotapi.com/v0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text}`);
    if (res.ok) {
      const data = JSON.parse(text);
      return data.access_token;
    }
  } catch (err) {
    console.error(`Error for ${label}:`, err.message);
  }
  return null;
}

async function testAll() {
  const credentials = {
    name: "agentt",
    apiKey: "8EupfD+JpLdJnB3En4xZkSvufZVtt/oR",
    apiSecret: "TQJzuSjsq41ljRIn6yxaS2Hryl+HNbdJ",
    apiId: "7caee559-241e-4bbb-913c-e4bb4a91aead"
  };

  // Combination A: API Key as Client ID, API Secret as Client Secret
  const tokenA = await tryAuth(credentials.apiKey, credentials.apiSecret, "Comb A: API Key + API Secret");

  // Combination B: API Id as Client ID, API Secret as Client Secret
  const tokenB = await tryAuth(credentials.apiId, credentials.apiSecret, "Comb B: API Id + API Secret");

  // Combination C: API Id as Client ID, API Key as Client Secret
  const tokenC = await tryAuth(credentials.apiId, credentials.apiKey, "Comb C: API Id + API Key");

  // Combination D: Name as Client ID, API Key as Client Secret
  const tokenD = await tryAuth(credentials.name, credentials.apiKey, "Comb D: Name + API Key");

  // Combination E: Name as Client ID, API Secret as Client Secret
  const tokenE = await tryAuth(credentials.name, credentials.apiSecret, "Comb E: Name + API Secret");
  
  const winningToken = tokenA || tokenB || tokenC || tokenD || tokenE;
  if (winningToken) {
    console.log("\nSuccess! Obtained token:", winningToken.substring(0, 15) + "...");
  } else {
    console.log("\nAll combinations failed auth!");
  }
}

testAll();
