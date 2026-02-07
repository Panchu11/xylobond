/**
 * XyloBond Skill - Withdraw Handler
 * Withdraws available (unlocked) bond
 */

const { getContracts, getSigner, parseUSDC, formatUSDC } = require("../lib/contracts");

async function handler(args, context) {
  const { amount } = args;
  const { wallet, network = "arc_testnet" } = context;
  
  if (!amount || amount <= 0) {
    return {
      success: false,
      message: "Invalid amount. Please specify a positive amount to withdraw."
    };
  }
  
  try {
    const signer = getSigner(wallet.privateKey, network);
    const contracts = getContracts(signer, network);
    const withdrawAmount = parseUSDC(amount);
    
    // Check bond status
    const status = await contracts.registry.getBondStatus(wallet.address);
    
    if (!status.isBonded) {
      return {
        success: false,
        message: "You don't have any bond to withdraw."
      };
    }
    
    if (status.availableAmount < withdrawAmount) {
      return {
        success: false,
        message: `Insufficient available bond. You have ${formatUSDC(status.availableAmount)} USDC available (${formatUSDC(status.lockedAmount)} USDC is locked under claims).`
      };
    }
    
    // Withdraw
    console.log(`Withdrawing ${amount} USDC from bond...`);
    const tx = await contracts.registry.withdrawBond(withdrawAmount);
    const receipt = await tx.wait();
    
    // Get updated status
    const newStatus = await contracts.registry.getBondStatus(wallet.address);
    
    return {
      success: true,
      message: `Successfully withdrew ${amount} USDC from your bond!`,
      data: {
        transactionHash: receipt.hash,
        withdrawn: amount + " USDC",
        remainingBond: formatUSDC(newStatus.totalBond) + " USDC",
        isBonded: newStatus.isBonded
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to withdraw: ${error.message}`
    };
  }
}

module.exports = { handler };
