/**
 * XyloBond Skill - Bond Handler
 * Posts a USDC bond to become insured
 */

const { getContracts, getSigner, parseUSDC, formatUSDC } = require("../lib/contracts");

async function handler(args, context) {
  const { amount } = args;
  const { wallet, network = "arc_testnet" } = context;
  
  if (!amount || amount < 10) {
    return {
      success: false,
      message: "Invalid amount. Minimum bond is 10 USDC."
    };
  }
  
  try {
    const signer = getSigner(wallet.privateKey, network);
    const contracts = getContracts(signer, network);
    const bondAmount = parseUSDC(amount);
    
    // Check USDC balance
    const balance = await contracts.usdc.balanceOf(wallet.address);
    if (balance < bondAmount) {
      return {
        success: false,
        message: `Insufficient USDC balance. You have ${formatUSDC(balance)} USDC, need ${amount} USDC.`
      };
    }
    
    // Check and set approval if needed
    const registryAddress = await contracts.registry.getAddress();
    const allowance = await contracts.usdc.allowance(wallet.address, registryAddress);
    
    if (allowance < bondAmount) {
      console.log("Approving USDC...");
      const approveTx = await contracts.usdc.approve(registryAddress, bondAmount);
      await approveTx.wait();
      console.log("USDC approved.");
    }
    
    // Post bond
    console.log(`Posting ${amount} USDC bond...`);
    const tx = await contracts.registry.postBond(bondAmount);
    const receipt = await tx.wait();
    
    // Get updated status
    const status = await contracts.registry.getBondStatus(wallet.address);
    
    return {
      success: true,
      message: `Successfully posted ${amount} USDC bond!`,
      data: {
        transactionHash: receipt.hash,
        totalBond: formatUSDC(status.totalBond),
        availableBond: formatUSDC(status.availableAmount),
        isBonded: status.isBonded
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to post bond: ${error.message}`
    };
  }
}

module.exports = { handler };
