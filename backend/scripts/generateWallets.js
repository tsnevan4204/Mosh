// scripts/generateWallets.js
const { Wallet } = require("ethers");

for (let i = 0; i < 3; i++) {
  const wallet = Wallet.createRandom();
  console.log(`Wallet ${i + 1}:`);
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("Mnemonic:", wallet.mnemonic.phrase);
  console.log("---------------------------");
}