const hre = require("hardhat");

async function main() {
  console.log("=".repeat(60));
  console.log("XyloBond Protocol Deployment");
  console.log("=".repeat(60));
  console.log("");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("");

  // USDC address on Arc Testnet
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000";
  console.log("USDC Address:", USDC_ADDRESS);
  console.log("");

  // ============ Deploy XyloBondReputation ============
  console.log("1. Deploying XyloBondReputation...");
  const XyloBondReputation = await hre.ethers.getContractFactory("XyloBondReputation");
  const reputation = await XyloBondReputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("   XyloBondReputation deployed to:", reputationAddress);
  console.log("");

  // ============ Deploy XyloBondRegistry ============
  console.log("2. Deploying XyloBondRegistry...");
  const XyloBondRegistry = await hre.ethers.getContractFactory("XyloBondRegistry");
  const registry = await XyloBondRegistry.deploy(USDC_ADDRESS, reputationAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   XyloBondRegistry deployed to:", registryAddress);
  console.log("");

  // ============ Deploy XyloBondClaims ============
  console.log("3. Deploying XyloBondClaims...");
  const XyloBondClaims = await hre.ethers.getContractFactory("XyloBondClaims");
  const claims = await XyloBondClaims.deploy(USDC_ADDRESS, registryAddress, reputationAddress);
  await claims.waitForDeployment();
  const claimsAddress = await claims.getAddress();
  console.log("   XyloBondClaims deployed to:", claimsAddress);
  console.log("");

  // ============ Configure Permissions ============
  console.log("4. Configuring permissions...");
  
  // Authorize Claims contract to manage bonds
  console.log("   Authorizing Claims contract on Registry...");
  const authRegistryTx = await registry.authorizeContract(claimsAddress);
  await authRegistryTx.wait();
  console.log("   Done.");

  // Authorize Registry and Claims to update reputation
  console.log("   Authorizing Registry on Reputation...");
  const authRepTx1 = await reputation.authorizeUpdater(registryAddress);
  await authRepTx1.wait();
  console.log("   Done.");

  console.log("   Authorizing Claims on Reputation...");
  const authRepTx2 = await reputation.authorizeUpdater(claimsAddress);
  await authRepTx2.wait();
  console.log("   Done.");
  console.log("");

  // ============ Summary ============
  console.log("=".repeat(60));
  console.log("Deployment Complete!");
  console.log("=".repeat(60));
  console.log("");
  console.log("Contract Addresses:");
  console.log("-".repeat(40));
  console.log("XyloBondReputation:", reputationAddress);
  console.log("XyloBondRegistry:  ", registryAddress);
  console.log("XyloBondClaims:    ", claimsAddress);
  console.log("");
  console.log("USDC Token:        ", USDC_ADDRESS);
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      XyloBondReputation: reputationAddress,
      XyloBondRegistry: registryAddress,
      XyloBondClaims: claimsAddress,
    },
    usdc: USDC_ADDRESS,
    deployedAt: new Date().toISOString(),
  };

  console.log("Deployment Info (save this):");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("");

  // Verification commands
  console.log("=".repeat(60));
  console.log("Verification Commands:");
  console.log("=".repeat(60));
  console.log("");
  console.log(`npx hardhat verify --network ${hre.network.name} ${reputationAddress}`);
  console.log("");
  console.log(`npx hardhat verify --network ${hre.network.name} ${registryAddress} "${USDC_ADDRESS}" "${reputationAddress}"`);
  console.log("");
  console.log(`npx hardhat verify --network ${hre.network.name} ${claimsAddress} "${USDC_ADDRESS}" "${registryAddress}" "${reputationAddress}"`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
