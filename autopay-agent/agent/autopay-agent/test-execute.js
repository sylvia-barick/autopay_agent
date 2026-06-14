const fetch = require('node-fetch');
const { ethers } = require('ethers');

async function testExecute() {
  const credentials = {
    clientId: "8EupfD+JpLdJnB3En4xZkSvufZVtt/oR",
    clientSecret: "TQJzuSjsq41ljRIn6yxaS2Hryl+HNbdJ",
    contractMethodId: "35a7ca92-2059-4278-ad9a-10f1c1b7768a"
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

    console.log("2. Executing contract method via 1Shot...");
    const amountInEth = "0.0005"; // 5 USD equivalent
    const weiVal = ethers.parseEther(amountInEth).toString();

    console.log(`Sending to contractMethodId: ${credentials.contractMethodId}`);
    console.log(`Params: recipient = 0x2d38928e42b1eeBDE0859820d3B96214F6dFad07, amount (wei) = ${weiVal}`);

    const execRes = await fetch(`https://api.1shotapi.com/v0/methods/${credentials.contractMethodId}/execute`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        params: {
          recipient: "0x2d38928e42b1eeBDE0859820d3B96214F6dFad07",
          amount: weiVal
        }
      })
    });

    console.log(`Status: ${execRes.status}`);
    const resText = await execRes.text();
    console.log(`Response: ${resText}`);

  } catch (err) {
    console.error("Error executing contract method:", err);
  }
}

testExecute();
