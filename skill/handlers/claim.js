/**
 * XyloBond Skill - Claim Handler
 * Files a claim against a bonded agent
 */

const { ethers } = require("ethers");
const { getContracts, getSigner, parseUSDC, formatUSDC } = require("../lib/contracts");

async function handler(args, context) {
  const { agent, amount, evidence } = args;
  const { wallet, network = "arc_testnet" } = context;
  
  if (!agent || !agent.match(/^0x[a-fA-F0-9]{40}$/)) {
    return {
      success: false,
      message: "Invalid agent address."
    };
  }
  
  if (!amount || amount <= 0) {
    return {
      success: false,
      message: "Invalid claim amount."
    };
  }
  
  if (!evidence || evidence.length < 5) {
    return {
      success: false,
      message: "Please provide evidence (transaction hash, IPFS link, or description)."
    };
  }
  
  if (agent.toLowerCase() === wallet.address.toLowerCase()) {
    return {
      success: false,
      message: "You cannot file a claim against yourself."
    };
  }
  
  try {
    const signer = getSigner(wallet.privateKey, network);
    const contracts = getContracts(signer, network);
    const claimAmount = parseUSDC(amount);
    
    // Check defendant is bonded
    const isBonded = await contracts.registry.isBonded(agent);
    if (!isBonded) {
      return {
        success: false,
        message: `Agent ${agent.slice(0, 10)}... is not bonded. You can only claim against bonded agents.`
      };
    }
    
    // Check defendant has sufficient bond
    const defendantBond = await contracts.registry.getBondAmount(agent);
    if (defendantBond < claimAmount) {
      return {
        success: false,
        message: `Agent only has ${formatUSDC(defendantBond)} USDC bonded. You cannot claim more than their bond.`
      };
    }
    
    // Calculate required stake (10% of claim, minimum 5 USDC)
    let stakeAmount = claimAmount / 10n;
    const minStake = parseUSDC(5);
    if (stakeAmount < minStake) {
      stakeAmount = minStake;
    }
    
    // Check claimant has stake
    const balance = await contracts.usdc.balanceOf(wallet.address);
    if (balance < stakeAmount) {
      return {
        success: false,
        message: `Insufficient USDC for stake. Need ${formatUSDC(stakeAmount)} USDC, have ${formatUSDC(balance)} USDC.`
      };
    }
    
    // Approve stake
    const claimsAddress = await contracts.claims.getAddress();
    const allowance = await contracts.usdc.allowance(wallet.address, claimsAddress);
    
    if (allowance < stakeAmount) {
      console.log("Approving USDC for stake...");
      const approveTx = await contracts.usdc.approve(claimsAddress, stakeAmount);
      await approveTx.wait();
    }
    
    // File claim
    console.log(`Filing claim for ${amount} USDC against ${agent.slice(0, 10)}...`);
    const tx = await contracts.claims.fileClaim(agent, claimAmount, evidence);
    const receipt = await tx.wait();
    
    // Get claim ID from ClaimFiled event logs
    let claimId = 0;
    const claimFiledTopic = ethers.id("ClaimFiled(uint256,address,address,uint256,string)");
    for (const log of receipt.logs) {
      if (log.topics[0] === claimFiledTopic) {
        // First indexed param is claimId
        claimId = Number(BigInt(log.topics[1]));
        break;
      }
    }
    // Fallback to stats if event parsing fails
    if (claimId === 0) {
      const stats = await contracts.claims.getStats();
      claimId = Number(stats.filed);
    }
    
    return {
      success: true,
      message: `Claim #${claimId} filed successfully!`,
      data: {
        claimId: claimId,
        defendant: agent,
        amount: `${amount} USDC`,
        stake: formatUSDC(stakeAmount) + " USDC",
        evidence: evidence,
        transactionHash: receipt.hash,
        note: "Your claim is now under review. If valid, you will receive the claimed amount plus your stake back."
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to file claim: ${error.message}`
    };
  }
}

module.exports = { handler };
