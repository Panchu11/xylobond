/**
 * XyloBond Contract Authorization Script
 * 
 * This script authorizes the Claims contract to interact with Registry and Reputation contracts.
 * This is REQUIRED for the claim system to work properly.
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("Starting XyloBond Contract Authorization...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Authorizing with account:", deployer.address);
  
  // Contract addresses (deployed)
  const REPUTATION_ADDRESS = "0x9a17E61Fe9343E16948759580c287770C38C1ef4";
  const REGISTRY_ADDRESS = "0x70E0e650F67F44509ba9020D06fa04e2a103907c";
  const CLAIMS_ADDRESS = "0x7B797ed5Ee7D64e8166c31A43bFb889da661A511";

  // ABIs for authorization functions
  const registryABI = [
    "function authorizeContract(address contractAddress) external",
    "function authorizedContracts(address) external view returns (bool)",
    "function owner() external view returns (address)"
  ];
  
  const reputationABI = [
    "function authorizeUpdater(address updater) external",
    "function authorizedUpdaters(address) external view returns (bool)",
    "function owner() external view returns (address)"
  ];

  // Get contract instances
  const registry = new ethers.Contract(REGISTRY_ADDRESS, registryABI, deployer);
  const reputation = new ethers.Contract(REPUTATION_ADDRESS, reputationABI, deployer);

  // Check ownership
  const registryOwner = await registry.owner();
  const reputationOwner = await reputation.owner();
  
  console.log("\nContract Owners:");
  console.log("  Registry owner:", registryOwner);
  console.log("  Reputation owner:", reputationOwner);
  console.log("  Your address:", deployer.address);

  if (registryOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("\nERROR: You are not the owner of the Registry contract!");
    return;
  }

  if (reputationOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("\nERROR: You are not the owner of the Reputation contract!");
    return;
  }

  // Check current authorization status
  const isClaimsAuthorizedOnRegistry = await registry.authorizedContracts(CLAIMS_ADDRESS);
  const isClaimsAuthorizedOnReputation = await reputation.authorizedUpdaters(CLAIMS_ADDRESS);

  console.log("\nCurrent Authorization Status:");
  console.log("  Claims authorized on Registry:", isClaimsAuthorizedOnRegistry);
  console.log("  Claims authorized on Reputation:", isClaimsAuthorizedOnReputation);

  // Authorize Claims on Registry (for lockBond, unlockBond, slashBond)
  if (!isClaimsAuthorizedOnRegistry) {
    console.log("\nAuthorizing Claims contract on Registry...");
    const tx1 = await registry.authorizeContract(CLAIMS_ADDRESS);
    await tx1.wait();
    console.log("  Transaction hash:", tx1.hash);
    console.log("  Claims contract authorized on Registry!");
  } else {
    console.log("\nClaims contract already authorized on Registry.");
  }

  // Authorize Claims on Reputation (for recordSuccess, recordFailure)
  if (!isClaimsAuthorizedOnReputation) {
    console.log("\nAuthorizing Claims contract on Reputation...");
    const tx2 = await reputation.authorizeUpdater(CLAIMS_ADDRESS);
    await tx2.wait();
    console.log("  Transaction hash:", tx2.hash);
    console.log("  Claims contract authorized on Reputation!");
  } else {
    console.log("\nClaims contract already authorized on Reputation.");
  }

  // Verify final status
  const finalRegistryAuth = await registry.authorizedContracts(CLAIMS_ADDRESS);
  const finalReputationAuth = await reputation.authorizedUpdaters(CLAIMS_ADDRESS);

  console.log("\n========================================");
  console.log("AUTHORIZATION COMPLETE");
  console.log("========================================");
  console.log("Claims authorized on Registry:", finalRegistryAuth);
  console.log("Claims authorized on Reputation:", finalReputationAuth);
  
  if (finalRegistryAuth && finalReputationAuth) {
    console.log("\nXyloBond protocol is now fully operational!");
    console.log("Claims can now lock/slash bonds and update reputation.");
  } else {
    console.log("\nWARNING: Some authorizations failed. Please check manually.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
