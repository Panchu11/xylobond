const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XyloBond Protocol", function () {
  let owner, agent1, agent2, arbiter;
  let usdc, reputation, registry, claims;
  
  const INITIAL_BALANCE = ethers.parseUnits("10000", 6); // 10,000 USDC
  const BOND_AMOUNT = ethers.parseUnits("100", 6); // 100 USDC
  const CLAIM_AMOUNT = ethers.parseUnits("50", 6); // 50 USDC
  
  beforeEach(async function () {
    [owner, agent1, agent2, arbiter] = await ethers.getSigners();
    
    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    
    // Mint USDC to agents
    await usdc.mint(agent1.address, INITIAL_BALANCE);
    await usdc.mint(agent2.address, INITIAL_BALANCE);
    
    // Deploy XyloBondReputation
    const XyloBondReputation = await ethers.getContractFactory("XyloBondReputation");
    reputation = await XyloBondReputation.deploy();
    await reputation.waitForDeployment();
    
    // Deploy XyloBondRegistry
    const XyloBondRegistry = await ethers.getContractFactory("XyloBondRegistry");
    registry = await XyloBondRegistry.deploy(
      await usdc.getAddress(),
      await reputation.getAddress()
    );
    await registry.waitForDeployment();
    
    // Deploy XyloBondClaims
    const XyloBondClaims = await ethers.getContractFactory("XyloBondClaims");
    claims = await XyloBondClaims.deploy(
      await usdc.getAddress(),
      await registry.getAddress(),
      await reputation.getAddress()
    );
    await claims.waitForDeployment();
    
    // Configure permissions
    await registry.authorizeContract(await claims.getAddress());
    await reputation.authorizeUpdater(await registry.getAddress());
    await reputation.authorizeUpdater(await claims.getAddress());
    
    // Add arbiter
    await claims.addArbiter(arbiter.address);
  });
  
  describe("XyloBondReputation", function () {
    it("Should return default score for new agents", async function () {
      const score = await reputation.getScore(agent1.address);
      expect(score).to.equal(50);
    });
    
    it("Should increase score on success", async function () {
      await reputation.authorizeUpdater(owner.address);
      await reputation.recordSuccess(agent1.address);
      const score = await reputation.getScore(agent1.address);
      expect(score).to.equal(55);
    });
    
    it("Should decrease score on failure", async function () {
      await reputation.authorizeUpdater(owner.address);
      await reputation.recordFailure(agent1.address);
      const score = await reputation.getScore(agent1.address);
      expect(score).to.equal(40);
    });
    
    it("Should return correct bond multiplier based on score", async function () {
      // Default score (50) = 100% multiplier
      const multiplier = await reputation.getRequiredBondMultiplier(agent1.address);
      expect(multiplier).to.equal(10000); // 100%
    });
  });
  
  describe("XyloBondRegistry", function () {
    it("Should allow posting bond", async function () {
      await usdc.connect(agent1).approve(await registry.getAddress(), BOND_AMOUNT);
      await registry.connect(agent1).postBond(BOND_AMOUNT);
      
      const status = await registry.getBondStatus(agent1.address);
      expect(status.totalBond).to.equal(BOND_AMOUNT);
      expect(status.isBonded).to.be.true;
    });
    
    it("Should reject bond below minimum", async function () {
      const smallAmount = ethers.parseUnits("5", 6); // 5 USDC
      await usdc.connect(agent1).approve(await registry.getAddress(), smallAmount);
      
      await expect(
        registry.connect(agent1).postBond(smallAmount)
      ).to.be.revertedWithCustomError(registry, "InvalidAmount");
    });
    
    it("Should allow withdrawing unlocked bond", async function () {
      await usdc.connect(agent1).approve(await registry.getAddress(), BOND_AMOUNT);
      await registry.connect(agent1).postBond(BOND_AMOUNT);
      
      const balanceBefore = await usdc.balanceOf(agent1.address);
      await registry.connect(agent1).withdrawBond(BOND_AMOUNT);
      const balanceAfter = await usdc.balanceOf(agent1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(BOND_AMOUNT);
    });
  });
  
  describe("XyloBondClaims", function () {
    beforeEach(async function () {
      // Agent1 posts bond
      await usdc.connect(agent1).approve(await registry.getAddress(), BOND_AMOUNT);
      await registry.connect(agent1).postBond(BOND_AMOUNT);
    });
    
    it("Should allow filing claim against bonded agent", async function () {
      const stakeAmount = ethers.parseUnits("5", 6);
      await usdc.connect(agent2).approve(await claims.getAddress(), stakeAmount);
      
      await claims.connect(agent2).fileClaim(
        agent1.address,
        CLAIM_AMOUNT,
        "tx:0x123456789abcdef"
      );
      
      const claim = await claims.getClaim(1);
      expect(claim.claimant).to.equal(agent2.address);
      expect(claim.defendant).to.equal(agent1.address);
      expect(claim.amount).to.equal(CLAIM_AMOUNT);
    });
    
    it("Should lock defendant bond when claim filed", async function () {
      const stakeAmount = ethers.parseUnits("5", 6);
      await usdc.connect(agent2).approve(await claims.getAddress(), stakeAmount);
      
      await claims.connect(agent2).fileClaim(
        agent1.address,
        CLAIM_AMOUNT,
        "tx:0x123456789abcdef"
      );
      
      const status = await registry.getBondStatus(agent1.address);
      expect(status.lockedAmount).to.equal(CLAIM_AMOUNT);
    });
    
    it("Should payout claimant when claim is valid", async function () {
      const stakeAmount = ethers.parseUnits("5", 6);
      await usdc.connect(agent2).approve(await claims.getAddress(), stakeAmount);
      
      await claims.connect(agent2).fileClaim(
        agent1.address,
        CLAIM_AMOUNT,
        "tx:0x123456789abcdef"
      );
      
      const balanceBefore = await usdc.balanceOf(agent2.address);
      
      await claims.connect(arbiter).resolveClaim(1, true, "Claim validated");
      
      const balanceAfter = await usdc.balanceOf(agent2.address);
      
      // Agent2 should receive: claim amount + stake returned
      expect(balanceAfter - balanceBefore).to.equal(CLAIM_AMOUNT + stakeAmount);
    });
    
    it("Should update reputation when claim resolved", async function () {
      const stakeAmount = ethers.parseUnits("5", 6);
      await usdc.connect(agent2).approve(await claims.getAddress(), stakeAmount);
      
      await claims.connect(agent2).fileClaim(
        agent1.address,
        CLAIM_AMOUNT,
        "tx:0x123456789abcdef"
      );
      
      await claims.connect(arbiter).resolveClaim(1, true, "Claim validated");
      
      // Agent1 (defendant) should have decreased reputation
      const agent1Score = await reputation.getScore(agent1.address);
      expect(agent1Score).to.equal(40); // 50 - 10
      
      // Agent2 (claimant) should have increased reputation
      const agent2Score = await reputation.getScore(agent2.address);
      expect(agent2Score).to.equal(55); // 50 + 5
    });
  });
  
  describe("Full Flow", function () {
    it("Should handle complete claim lifecycle", async function () {
      // 1. Agent1 posts bond
      await usdc.connect(agent1).approve(await registry.getAddress(), BOND_AMOUNT);
      await registry.connect(agent1).postBond(BOND_AMOUNT);
      
      // 2. Agent2 verifies Agent1 is bonded
      expect(await registry.isBonded(agent1.address)).to.be.true;
      
      // 3. Something goes wrong, Agent2 files claim
      const stakeAmount = ethers.parseUnits("5", 6);
      await usdc.connect(agent2).approve(await claims.getAddress(), stakeAmount);
      await claims.connect(agent2).fileClaim(
        agent1.address,
        CLAIM_AMOUNT,
        "Service not delivered: tx:0xabc123"
      );
      
      // 4. Arbiter resolves claim as valid
      await claims.connect(arbiter).resolveClaim(1, true, "Evidence confirms failure to deliver");
      
      // 5. Verify final state
      const claim = await claims.getClaim(1);
      expect(claim.status).to.equal(2); // ResolvedValid
      
      const agent1Bond = await registry.getBondAmount(agent1.address);
      expect(agent1Bond).to.equal(BOND_AMOUNT - CLAIM_AMOUNT);
      
      const stats = await claims.getStats();
      expect(stats.filed).to.equal(1);
      expect(stats.resolved).to.equal(1);
      expect(stats.payouts).to.equal(CLAIM_AMOUNT);
    });
  });
});
