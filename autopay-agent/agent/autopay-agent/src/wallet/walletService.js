const { ethers } = require("ethers");

function generateWallet() {
  const wallet = ethers.Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

module.exports = {
  generateWallet,
};