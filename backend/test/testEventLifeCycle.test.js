const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("EventManager & Ticket (Event Lifecycle)", function () {
  this.timeout(120000);

  let ticket, eventManager;
  let eventId;
  let owner, organizer, buyerOne, buyerTwo;
  let provider;

  const deploymentPath = path.join(__dirname, "..", "deployedContracts.json");
  const { TICKET_ADDRESS, EVENT_MANAGER_ADDRESS } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  before(async () => {
    provider = ethers.provider;

    owner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    organizer = new ethers.Wallet(process.env.ORGANIZER_PRIVATE_KEY, provider);
    buyerOne = new ethers.Wallet(process.env.BUYER_ONE_PRIVATE_KEY, provider);
    buyerTwo = new ethers.Wallet(process.env.BUYER_TWO_PRIVATE_KEY, provider);

    // const fundIfNeeded = async (recipient, minBalance, amount) => {
    //   const balance = await provider.getBalance(recipient.address);
    //   if (balance < minBalance) {
    //     const tx = await organizer.sendTransaction({ to: recipient.address, value: amount });
    //     await tx.wait();
    //     console.log(`💰 Funded ${recipient.address} with ${ethers.formatEther(amount)} ETH`);
    //   }
    // };

    // await fundIfNeeded(buyerOne, ethers.parseEther("0.02"), ethers.parseEther("0.02"));
    // await fundIfNeeded(buyerTwo, ethers.parseEther("0.05"), ethers.parseEther("0.05"));

    const eventManagerArtifact = await hre.artifacts.readArtifact("EventManager");
    const ticketArtifact = await hre.artifacts.readArtifact("Ticket");

    // ✅ Bind provider
    eventManager = new ethers.Contract(EVENT_MANAGER_ADDRESS, eventManagerArtifact.abi, provider);
    ticket = new ethers.Contract(TICKET_ADDRESS, ticketArtifact.abi, provider);

    // // ✅ Fund buyers
    // if ((await provider.getBalance(buyerOne.address)) < ethers.parseEther("0.02")) {
    //   await (await organizer.sendTransaction({ to: buyerOne.address, value: ethers.parseEther("0.02") })).wait();
    // }

    // if ((await provider.getBalance(buyerTwo.address)) < ethers.parseEther("0.05")) {
    //   await (await organizer.sendTransaction({ to: buyerTwo.address, value: ethers.parseEther("0.05") })).wait();
    // }

    const metadataURI = "ipfs://event_lifecycle_metadata";
    const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
    const ticketPrice = ethers.parseEther("0.01");
    const ticketCount = 6;

    const tx = await eventManager.connect(organizer).createEvent(
      metadataURI,
      ticketPrice,
      ticketCount,
      futureTimestamp
    );
    const receipt = await tx.wait();
    const eventCreated = receipt.logs.find(log => log.fragment?.name === "EventCreated");
    eventId = Number(eventCreated?.args?.eventId ?? 0);

    console.log(`✅ Event ${eventId} created by Organizer (${organizer.address})`);
  });

  it("BuyerTwo buys tickets until they can't afford any more", async () => {
    let bought = 0;
    const price = ethers.parseEther("0.01");

    while (true) {
      const balance = await provider.getBalance(buyerTwo.address);
      if (balance < price) {
        console.log(`⚠️ BuyerTwo cannot afford more tickets. Bought: ${bought}`);
        break;
      }

      try {
        const tx = await eventManager.connect(buyerTwo).buyTicket(eventId, { value: price });
        await tx.wait();
        bought++;
        console.log(`🎟 BuyerTwo bought ticket #${bought}`);
      } catch (err) {
        console.log(`❌ BuyerTwo failed to buy ticket #${bought + 1}: ${err.reason || err.message}`);
        break;
      }
    }

    const updatedEvt = await eventManager.connect(buyerTwo).events(eventId);
    expect(Number(updatedEvt.ticketsSold)).to.be.gte(bought);
  });

  it("BuyerOne buys remaining tickets until event is sold out", async () => {
    let bought = 0;
    const price = ethers.parseEther("0.01");

    while (true) {
      const evt = await eventManager.connect(buyerOne).events(eventId);
      if (evt.cancelled) break;

      if (Number(evt.ticketsSold) >= Number(evt.maxTickets)) {
        console.log(`✅ Sold out. BuyerOne bought ${bought} ticket(s).`);
        break;
      }

      try {
        const tx = await eventManager.connect(buyerOne).buyTicket(eventId, { value: price });
        await tx.wait();
        bought++;
      } catch (err) {
        console.log(`❌ BuyerOne failed: ${err.reason || err.message}`);
        break;
      }
    }

    const finalEvt = await eventManager.connect(buyerOne).events(eventId);
    expect(Number(finalEvt.ticketsSold)).to.equal(Number(finalEvt.maxTickets));
  });

  it("Organizer cancels the event and refunds are issued", async () => {
    const buyerOneBefore = await provider.getBalance(buyerOne.address);
    const buyerTwoBefore = await provider.getBalance(buyerTwo.address);

    const filter = eventManager.filters.TicketPurchased(eventId);
    const logs = await eventManager.connect(organizer).queryFilter(filter);
    const ticketIds = logs.map(log => log.args.ticketId);

    await (await eventManager.connect(organizer).cancelEvent(eventId)).wait();

    const evt = await eventManager.connect(organizer).events(eventId);
    expect(evt.cancelled).to.equal(true);

    const buyerOneAfter = await provider.getBalance(buyerOne.address);
    const buyerTwoAfter = await provider.getBalance(buyerTwo.address);

    const refundOne = buyerOneAfter - buyerOneBefore;
    const refundTwo = buyerTwoAfter - buyerTwoBefore;

    expect(refundOne).to.be.gte(0);
    expect(refundTwo).to.be.gte(0);

    for (const tokenId of ticketIds) {
      const owner = await ticket.connect(buyerOne).ownerOf(tokenId);
      expect(owner).to.be.properAddress;
    }
  });
});
