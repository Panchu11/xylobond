/**
 * XyloBond Skill - Status Handler
 * Shows the caller's own bond status and reputation
 */

const { getContracts, getProvider, formatUSDC, getMultiplierDescription } = require("../lib/contracts");

async function handler(args, context) {
  const { wallet, network = "arc_testnet" } = context;
  
  if (!wallet || !wallet.address) {
    return {
      success: false,
      message: "Wallet not connected. Please connect your wallet first."
    };
  }
  
  try {
    const provider = getProvider(network);
    const contracts = getContracts(provider, network);
    const address = wallet.address;
    
    // Get bond status
    const bondStatus = await contracts.registry.getBondStatus(address);
    
    // Get reputation
    const repStats = await contracts.reputation.getAgentStats(address);
    const tier = await contracts.reputation.getTier(address);
    
    // Get USDC balance
    const usdcBalance = await contracts.usdc.balanceOf(address);
    
    // Get claims info
    const claimsFiled = await contracts.claims.getClaimsByClaimant(address);
    const claimsAgainst = await contracts.claims.getClaimsAgainstDefendant(address);
    
    const multiplier = Number(repStats.multiplier);
    const multiplierDesc = getMultiplierDescription(multiplier);
    
    return {
      success: true,
      message: bondStatus.isBonded 
        ? `You are bonded with ${formatUSDC(bondStatus.totalBond)} USDC. Reputation: ${Number(repStats.score)}/100 (${tier}).`
        : `You are NOT bonded. Reputation: ${Number(repStats.score)}/100 (${tier}).`,
      data: {
        address: address,
        wallet: {
          usdcBalance: formatUSDC(usdcBalance) + " USDC"
        },
        bond: {
          isBonded: bondStatus.isBonded,
          total: formatUSDC(bondStatus.totalBond) + " USDC",
          locked: formatUSDC(bondStatus.lockedAmount) + " USDC",
          available: formatUSDC(bondStatus.availableAmount) + " USDC",
          bondedSince: bondStatus.isBonded 
            ? new Date(Number(bondStatus.timestamp) * 1000).toISOString()
            : null
        },
        reputation: {
          score: Number(repStats.score),
          maxScore: 100,
          tier: tier,
          successes: Number(repStats.successes),
          failures: Number(repStats.failures),
          bondMultiplier: `${multiplier / 100}%`,
          bondEffect: multiplierDesc
        },
        claims: {
          filed: claimsFiled.length,
          against: claimsAgainst.length
        }
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to get status: ${error.message}`
    };
  }
}

module.exports = { handler };
