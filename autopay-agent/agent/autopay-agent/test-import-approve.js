const fetch = require('node-fetch');

async function importApprove() {
  const credentials = {
    clientId: "8EupfD+JpLdJnB3En4xZkSvufZVtt/oR",
    clientSecret: "TQJzuSjsq41ljRIn6yxaS2Hryl+HNbdJ",
    businessId: "c237dd76-7141-482b-9ff1-7606dba28fd7",
    walletId: "9771e769-ddfd-4d36-b8eb-b684443f31cf"
  };

  const abi = [
    {
      "constant": false,
      "inputs": [
        {
          "name": "recipient",
          "type": "address"
        },
        {
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

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

    console.log("2. Importing approve contract method from ABI...");
    const importRes = await fetch(`https://api.1shotapi.com/v0/business/${credentials.businessId}/methods/abi`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        businessId: credentials.businessId,
        chainId: 11155111,
        contractAddress: "0x7b79995e5f793a07bc00c21412e50ecae098e7f9", // WETH9 on Sepolia
        walletId: credentials.walletId,
        abi: abi,
        name: "WETH9 Approve",
        description: "Approve allowance on WETH9 contract on Sepolia"
      })
    });

    console.log(`Status: ${importRes.status}`);
    const text = await importRes.text();
    console.log(`Response: ${text}`);

  } catch (err) {
    console.error("Error importing approve:", err);
  }
}

importApprove();
