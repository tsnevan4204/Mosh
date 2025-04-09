const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;

  const organizer = new ethers.Wallet(process.env.ORGANIZER_PRIVATE_KEY, provider);
  const owner = "0xEf9334A1C6B77d09780eaD908D8cCdB9fA211Ae9"; // Replace with actual owner address if different

  const tx = await organizer.sendTransaction({
    to: owner,
    value: ethers.parseEther("0.02")
  });

  console.log("⛽ Sending 0.02 ETH from organizer...");
  await tx.wait();
  console.log(`✅ Sent 0.02 ETH to ${owner}`);
}

main().catch((error) => {
  console.error("❌ Transaction failed:", error);
  process.exitCode = 1;
});
