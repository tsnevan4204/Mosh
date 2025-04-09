/* temporary adjustments to balance due to testTemplate.test.js 
do not run this either tbh */

const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const provider = ethers.provider;

  // Load wallets from .env
  const organizer = new ethers.Wallet(process.env.ORGANIZER_PRIVATE_KEY, provider);
  const buyerOne = new ethers.Wallet(process.env.BUYER_ONE_PRIVATE_KEY, provider);

  const amount = ethers.parseEther("0.04");

  console.log(`Sending 0.04 ETH from ${organizer.address} → ${buyerOne.address}`);

  const tx = await organizer.sendTransaction({
    to: buyerOne.address,
    value: amount
  });

  console.log("Transaction sent. Waiting for confirmation...");
  const receipt = await tx.wait();

  console.log("✅ Transfer complete!");
  console.log("🔗 Tx hash:", receipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});