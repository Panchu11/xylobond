/**
 * XyloBond Skill - Reputation Handler
 * Checks an agent's reputation score and tier
 */

const { getContracts, getProvider, getMultiplierDescription } = require("../lib/contracts");

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
    
    // Get reputation stats
    const stats = await contracts.reputation.getAgentStats(agent);
    const tier = await contracts.reputation.getTier(agent);
    
    const score = Number(stats.score);
    const multiplier = Number(stats.multiplier);
    const multiplierDesc = getMultiplierDescription(multiplier);
    
    // Build reputation summary
    let summary = "";
    if (score >= 80) {
      summary = "Excellent reputation! This agent has a strong track record.";
    } else if (score >= 60) {
      summary = "Good reputation. This agent is generally reliable.";
    } else if (score >= 40) {
      summary = "Neutral reputation. Standard risk level.";
    } else if (score >= 20) {
      summary = "Poor reputation. Exercise caution when transacting.";
    } else {
      summary = "Bad reputation. High risk - multiple claims validated against this agent.";
    }
    
    return {
      success: true,
      message: `Agent ${agent.slice(0, 10)}... has a reputation score of ${score}/100 (${tier}).`,
      data: {
        agent: agent,
        score: score,
        maxScore: 100,
        tier: tier,
        successes: Number(stats.successes),
        failures: Number(stats.failures),
        bondMultiplier: `${multiplier / 100}%`,
        bondEffect: multiplierDesc,
        summary: summary
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to check reputation: ${error.message}`
    };
  }
}

module.exports = { handler };
