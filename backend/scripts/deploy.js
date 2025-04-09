const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const ethers = hre.ethers;

  console.log("🚀 Deploying Mosh contracts with:", deployer.address);

  // Deploy Ticket with dummy EventManager address
  const Ticket = await ethers.getContractFactory("Ticket");
  const AddressZero = "0x0000000000000000000000000000000000000000";
  const ticket = await Ticket.deploy(AddressZero);
  await ticket.waitForDeployment();
  console.log("🎟️ Ticket deployed at:", ticket.target);

  // Deploy EventManager with actual Ticket address
  const EventManager = await ethers.getContractFactory("EventManager");
  const eventManager = await EventManager.deploy(ticket.target);
  await eventManager.waitForDeployment();
  console.log("🎤 EventManager deployed at:", eventManager.target);

  // Update Ticket with the real EventManager address
  const tx = await ticket.updateEventManager(eventManager.target);
  await tx.wait();
  console.log("🔗 Linked EventManager to Ticket");

  // Write ABI + address to frontend/abis/
  const abisDir = path.join(__dirname, "..", "..", "frontend", "abis");
  if (!fs.existsSync(abisDir)) fs.mkdirSync(abisDir, { recursive: true });

  const ticketArtifact = await hre.artifacts.readArtifact("Ticket");
  const eventManagerArtifact = await hre.artifacts.readArtifact("EventManager");

  fs.writeFileSync(
    path.join(abisDir, "Ticket.json"),
    JSON.stringify({ address: ticket.target, abi: ticketArtifact.abi }, null, 2)
  );

  fs.writeFileSync(
    path.join(abisDir, "EventManager.json"),
    JSON.stringify({ address: eventManager.target, abi: eventManagerArtifact.abi }, null, 2)
  );

  const deployments = {
    TICKET_ADDRESS: await ticket.getAddress(),
    EVENT_MANAGER_ADDRESS: await eventManager.getAddress(),
  };

  const filePath = path.join(__dirname, "..", "deployedContracts.json");
  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
  console.log("✅ Saved deployed addresses to deployedContracts.json");

  console.log("📦 Exported ABIs + addresses to frontend/abis/");
  console.log("✅ Done.");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});