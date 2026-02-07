/**
 * XyloBond Skill - Check Handler
 * Checks if an agent is bonded and their status
 */

const { getContracts, getProvider, formatUSDC } = require("../lib/contracts");

async function handler(args, context) {
  const { agent } = args;
  const { network = "arc_testnet" } = context;
  
  if (!agent || !agent.match(/^0x[a-fA-F0-9]{40}$/)) {
    return {
      success: false,
      message: "Invalid agent address. Please provide a valid Ethereum address."
    };
  }
  
  try {
    const provider = getProvider(network);
    const contracts = getContracts(provider, network);
    
    // Get bond status
    const status = await contracts.registry.getBondStatus(agent);
    
    // Get reputation
    const repStats = await contracts.reputation.getAgentStats(agent);
    const tier = await contracts.reputation.getTier(agent);
    
    if (!status.isBonded) {
      return {
        success: true,
        message: `Agent ${agent.slice(0, 10)}... is NOT bonded.`,
        data: {
          isBonded: false,
          reputation: {
            score: Number(repStats.score),
            tier: tier,
            successes: Number(repStats.successes),
            failures: Number(repStats.failures)
          }
        }
      };
    }
    
    return {
      success: true,
      message: `Agent ${agent.slice(0, 10)}... is bonded with ${formatUSDC(status.totalBond)} USDC.`,
      data: {
        isBonded: true,
        bond: {
          total: formatUSDC(status.totalBond),
          locked: formatUSDC(status.lockedAmount),
          available: formatUSDC(status.availableAmount),
          bondedSince: new Date(Number(status.timestamp) * 1000).toISOString()
        },
        reputation: {
          score: Number(repStats.score),
          tier: tier,
          successes: Number(repStats.successes),
          failures: Number(repStats.failures),
          bondMultiplier: `${Number(repStats.multiplier) / 100}%`
        }
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to check agent: ${error.message}`
    };
  }
}

module.exports = { handler };
