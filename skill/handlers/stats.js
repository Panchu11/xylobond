/**
 * XyloBond Skill - Stats Handler
 * Shows XyloBond protocol statistics
 */

const { getContracts, getProvider, formatUSDC } = require("../lib/contracts");

async function handler(args, context) {
  const { network = "arc_testnet" } = context;
  
  try {
    const provider = getProvider(network);
    const contracts = getContracts(provider, network);
    
    // Get registry stats
    const registryStats = await contracts.registry.getProtocolStats();
    
    // Get claims stats
    const claimsStats = await contracts.claims.getStats();
    
    return {
      success: true,
      message: `XyloBond Protocol: ${formatUSDC(registryStats.deposited)} USDC bonded, ${Number(claimsStats.filed)} claims filed.`,
      data: {
        protocol: "XyloBond",
        network: network,
        bonds: {
          totalDeposited: formatUSDC(registryStats.deposited) + " USDC",
          totalSlashed: formatUSDC(registryStats.slashed) + " USDC",
          activeAgents: Number(registryStats.agents)
        },
        claims: {
          totalFiled: Number(claimsStats.filed),
          totalResolved: Number(claimsStats.resolved),
          totalPayouts: formatUSDC(claimsStats.payouts) + " USDC",
          pendingClaims: Number(claimsStats.filed) - Number(claimsStats.resolved)
        },
        description: "XyloBond is the first AI agent insurance protocol. Agents post USDC bonds, file claims against bad actors, and build on-chain reputation."
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to get stats: ${error.message}`
    };
  }
}

module.exports = { handler };
