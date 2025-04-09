require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

module.exports = {
  solidity: "0.8.19",
  networks: {
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    },
    "sepolia": {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY,
        process.env.ORGANIZER_PRIVATE_KEY,
        process.env.BUYER_ONE_PRIVATE_KEY,
        process.env.BUYER_TWO_PRIVATE_KEY]
    }
  }
};
