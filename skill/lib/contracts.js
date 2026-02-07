/**
 * XyloBond Skill - Contract Interaction Library
 * Provides utilities for interacting with XyloBond smart contracts
 */

const { ethers } = require("ethers");

// Contract ABIs (simplified for skill usage)
const REGISTRY_ABI = [
  "function postBond(uint256 amount) external",
  "function withdrawBond(uint256 amount) external",
  "function getBondStatus(address agent) external view returns (uint256 totalBond, uint256 lockedAmount, uint256 availableAmount, uint256 timestamp, bool isBonded)",
  "function getBondAmount(address agent) external view returns (uint256)",
  "function isBonded(address agent) external view returns (bool)",
  "function calculateRequiredBond(address agent, uint256 baseAmount) external view returns (uint256)",
  "function getProtocolStats() external view returns (uint256 deposited, uint256 slashed, uint256 agents)"
];

const CLAIMS_ABI = [
  "function fileClaim(address defendant, uint256 amount, string calldata evidence) external returns (uint256)",
  "function getClaim(uint256 claimId) external view returns (tuple(uint256 id, address claimant, address defendant, uint256 amount, uint256 claimantStake, string evidence, uint8 status, uint256 filedAt, uint256 resolvedAt, string resolution))",
  "function getClaimsByClaimant(address claimant) external view returns (uint256[])",
  "function getClaimsAgainstDefendant(address defendant) external view returns (uint256[])",
  "function getStats() external view returns (uint256 filed, uint256 resolved, uint256 payouts)"
];

const REPUTATION_ABI = [
  "function getScore(address agent) external view returns (uint256)",
  "function getRequiredBondMultiplier(address agent) external view returns (uint256)",
  "function getAgentStats(address agent) external view returns (uint256 score, uint256 successes, uint256 failures, uint256 multiplier)",
  "function getTier(address agent) external view returns (string)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// Contract addresses - DEPLOYED ON ARC TESTNET
const CONTRACTS = {
  arc_testnet: {
    usdc: "0x3600000000000000000000000000000000000000",
    reputation: "0x9a17E61Fe9343E16948759580c287770C38C1ef4",
    registry: "0x70E0e650F67F44509ba9020D06fa04e2a103907c",
    claims: "0x7B797ed5Ee7D64e8166c31A43bFb889da661A511"
  }
};

const RPC_URLS = {
  arc_testnet: "https://rpc.testnet.arc.network"
};

/**
 * Get provider for network
 */
function getProvider(network = "arc_testnet") {
  return new ethers.JsonRpcProvider(RPC_URLS[network]);
}

/**
 * Get signer from private key
 */
function getSigner(privateKey, network = "arc_testnet") {
  const provider = getProvider(network);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Get contract instances
 */
function getContracts(signerOrProvider, network = "arc_testnet") {
  const addresses = CONTRACTS[network];
  
  return {
    usdc: new ethers.Contract(addresses.usdc, ERC20_ABI, signerOrProvider),
    registry: new ethers.Contract(addresses.registry, REGISTRY_ABI, signerOrProvider),
    claims: new ethers.Contract(addresses.claims, CLAIMS_ABI, signerOrProvider),
    reputation: new ethers.Contract(addresses.reputation, REPUTATION_ABI, signerOrProvider)
  };
}

/**
 * Format USDC amount (6 decimals)
 */
function formatUSDC(amount) {
  return ethers.formatUnits(amount, 6);
}

/**
 * Parse USDC amount (6 decimals)
 */
function parseUSDC(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}

/**
 * Get reputation tier name from score
 */
function getTierFromScore(score) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Neutral";
  if (score >= 20) return "Poor";
  return "Bad";
}

/**
 * Get bond discount/premium from multiplier
 */
function getMultiplierDescription(multiplier) {
  const percentage = Number(multiplier) / 100;
  if (percentage < 100) {
    return `${100 - percentage}% discount`;
  } else if (percentage > 100) {
    return `${percentage - 100}% premium`;
  }
  return "Standard rate";
}

module.exports = {
  CONTRACTS,
  RPC_URLS,
  REGISTRY_ABI,
  CLAIMS_ABI,
  REPUTATION_ABI,
  ERC20_ABI,
  getProvider,
  getSigner,
  getContracts,
  formatUSDC,
  parseUSDC,
  getTierFromScore,
  getMultiplierDescription
};
