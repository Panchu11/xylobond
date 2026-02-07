/**
 * XyloBond - Post Test Bond Script
 * Posts a test bond to demonstrate the protocol is live
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("Posting test bond to XyloBond Protocol...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);

  // Contract addresses
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  const REGISTRY_ADDRESS = "0x70E0e650F67F44509ba9020D06fa04e2a103907c";
  const REPUTATION_ADDRESS = "0x9a17E61Fe9343E16948759580c287770C38C1ef4";

  // ABIs
  const usdcABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];

  const registryABI = [
    "function postBond(uint256 amount) external",
    "function getBondStatus(address) view returns (uint256 totalBond, uint256 lockedAmount, uint256 availableAmount, uint256 timestamp, bool isBonded)",
    "function getProtocolStats() view returns (uint256 deposited, uint256 slashed, uint256 agents)"
  ];

  const reputationABI = [
    "function getScore(address) view returns (uint256)",
    "function getTier(address) view returns (string)"
  ];

  // Get contracts
  const usdc = new ethers.Contract(USDC_ADDRESS, usdcABI, deployer);
  const registry = new ethers.Contract(REGISTRY_ADDRESS, registryABI, deployer);
  const reputation = new ethers.Contract(REPUTATION_ADDRESS, reputationABI, deployer);

  // Check balance
  const balance = await usdc.balanceOf(deployer.address);
  console.log("USDC Balance:", ethers.formatUnits(balance, 6), "USDC");

  // Bond amount: 100 USDC
  const bondAmount = ethers.parseUnits("100", 6);
  console.log("\nBond amount:", ethers.formatUnits(bondAmount, 6), "USDC");

  // Check and set approval
  const allowance = await usdc.allowance(deployer.address, REGISTRY_ADDRESS);
  if (allowance < bondAmount) {
    console.log("\nApproving USDC...");
    const approveTx = await usdc.approve(REGISTRY_ADDRESS, bondAmount);
    await approveTx.wait();
    console.log("Approval tx:", approveTx.hash);
  }

  // Post bond
  console.log("\nPosting bond...");
  const bondTx = await registry.postBond(bondAmount);
  const receipt = await bondTx.wait();
  console.log("Bond tx:", bondTx.hash);

  // Get updated status
  const status = await registry.getBondStatus(deployer.address);
  const score = await reputation.getScore(deployer.address);
  const tier = await reputation.getTier(deployer.address);
  const stats = await registry.getProtocolStats();

  console.log("\n========================================");
  console.log("BOND POSTED SUCCESSFULLY!");
  console.log("========================================");
  console.log("\nYour Bond Status:");
  console.log("  Total Bond:", ethers.formatUnits(status.totalBond, 6), "USDC");
  console.log("  Available:", ethers.formatUnits(status.availableAmount, 6), "USDC");
  console.log("  Is Bonded:", status.isBonded);
  console.log("\nYour Reputation:");
  console.log("  Score:", score.toString(), "/ 100");
  console.log("  Tier:", tier);
  console.log("\nProtocol Stats:");
  console.log("  Total Deposited:", ethers.formatUnits(stats.deposited, 6), "USDC");
  console.log("  Total Agents:", stats.agents.toString());
  console.log("\nXyloBond is now LIVE with real bonds!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
