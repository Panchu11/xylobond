// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IXyloBondRegistry.sol";
import "./interfaces/IXyloBondReputation.sol";

/**
 * @title XyloBondClaims
 * @author XyloBond Protocol
 * @notice Handles claim filing, arbitration, and payouts for AI agent disputes
 * @dev Claims are filed by agents who were harmed by bonded agents
 * 
 * Claim Lifecycle:
 * 1. Claimant files claim with evidence and stake
 * 2. Defendant's bond is locked for claim amount
 * 3. Arbiter reviews and resolves claim
 * 4. If valid: Claimant receives payout from defendant's bond
 * 5. If invalid: Claimant loses their stake
 * 6. Reputation is updated accordingly
 */
contract XyloBondClaims is Ownable, ReentrancyGuard {
    
    // ============ Enums ============
    
    enum ClaimStatus {
        Open,
        UnderReview,
        ResolvedValid,
        ResolvedInvalid,
        Cancelled
    }
    
    // ============ Structs ============
    
    struct Claim {
        uint256 id;
        address claimant;          // Who filed the claim
        address defendant;         // Against whom
        uint256 amount;            // Requested payout amount
        uint256 claimantStake;     // Anti-spam stake
        string evidence;           // Evidence (IPFS hash, tx hashes, etc.)
        ClaimStatus status;        // Current status
        uint256 filedAt;           // Timestamp
        uint256 resolvedAt;        // Resolution timestamp
        string resolution;         // Arbiter's reasoning
    }
    
    // ============ Constants ============
    
    uint256 public constant MIN_CLAIM_STAKE = 5 * 1e6; // 5 USDC
    uint256 public constant CLAIM_TIMEOUT = 7 days;     // Auto-resolve after 7 days
    
    // ============ State Variables ============
    
    /// @notice USDC token contract
    IERC20 public immutable usdc;
    
    /// @notice Registry contract
    IXyloBondRegistry public registry;
    
    /// @notice Reputation contract
    IXyloBondReputation public reputation;
    
    /// @notice All claims
    mapping(uint256 => Claim) public claims;
    
    /// @notice Total claim count
    uint256 public claimCount;
    
    /// @notice Claims by claimant
    mapping(address => uint256[]) public claimsByClaimant;
    
    /// @notice Claims against defendant
    mapping(address => uint256[]) public claimsAgainstDefendant;
    
    /// @notice Authorized arbiters
    mapping(address => bool) public arbiters;
    
    /// @notice Protocol statistics
    uint256 public totalClaimsFiled;
    uint256 public totalClaimsResolved;
    uint256 public totalPayouts;
    
    // ============ Events ============
    
    event ClaimFiled(
        uint256 indexed claimId,
        address indexed claimant,
        address indexed defendant,
        uint256 amount,
        string evidence
    );
    
    event ClaimResolved(
        uint256 indexed claimId,
        bool isValid,
        uint256 payoutAmount,
        string resolution
    );
    
    event ClaimCancelled(uint256 indexed claimId, address indexed claimant);
    
    event ArbiterAdded(address indexed arbiter);
    event ArbiterRemoved(address indexed arbiter);
    
    // ============ Errors ============
    
    error InvalidAddress();
    error InvalidAmount();
    error InvalidClaimId();
    error ClaimNotOpen();
    error NotClaimant();
    error NotArbiter();
    error DefendantNotBonded();
    error InsufficientDefendantBond();
    error TransferFailed();
    error CannotClaimAgainstSelf();
    
    // ============ Modifiers ============
    
    modifier onlyArbiter() {
        if (!arbiters[msg.sender] && msg.sender != owner()) {
            revert NotArbiter();
        }
        _;
    }
    
    modifier validClaimId(uint256 claimId) {
        if (claimId == 0 || claimId > claimCount) {
            revert InvalidClaimId();
        }
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize the claims contract
     * @param _usdc USDC token address
     * @param _registry Registry contract address
     * @param _reputation Reputation contract address
     */
    constructor(
        address _usdc,
        address _registry,
        address _reputation
    ) Ownable(msg.sender) {
        if (_usdc == address(0)) revert InvalidAddress();
        if (_registry == address(0)) revert InvalidAddress();
        if (_reputation == address(0)) revert InvalidAddress();
        
        usdc = IERC20(_usdc);
        registry = IXyloBondRegistry(_registry);
        reputation = IXyloBondReputation(_reputation);
        
        // Owner is default arbiter
        arbiters[msg.sender] = true;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice File a claim against a bonded agent
     * @param defendant The agent to claim against
     * @param amount The requested payout amount
     * @param evidence Evidence supporting the claim (IPFS hash, tx hashes, etc.)
     * @return claimId The ID of the new claim
     */
    function fileClaim(
        address defendant,
        uint256 amount,
        string calldata evidence
    ) external nonReentrant returns (uint256 claimId) {
        if (defendant == address(0)) revert InvalidAddress();
        if (defendant == msg.sender) revert CannotClaimAgainstSelf();
        if (amount == 0) revert InvalidAmount();
        if (bytes(evidence).length == 0) revert InvalidAmount();
        
        // Check defendant is bonded
        if (!registry.isBonded(defendant)) revert DefendantNotBonded();
        
        // Check defendant has sufficient bond
        uint256 defendantBond = registry.getBondAmount(defendant);
        if (defendantBond < amount) revert InsufficientDefendantBond();
        
        // Calculate required stake (minimum of MIN_CLAIM_STAKE or 10% of claim)
        uint256 requiredStake = amount / 10;
        if (requiredStake < MIN_CLAIM_STAKE) {
            requiredStake = MIN_CLAIM_STAKE;
        }
        
        // Transfer stake from claimant
        bool success = usdc.transferFrom(msg.sender, address(this), requiredStake);
        if (!success) revert TransferFailed();
        
        // Lock defendant's bond
        registry.lockBond(defendant, amount);
        
        // Create claim
        claimCount++;
        claimId = claimCount;
        
        claims[claimId] = Claim({
            id: claimId,
            claimant: msg.sender,
            defendant: defendant,
            amount: amount,
            claimantStake: requiredStake,
            evidence: evidence,
            status: ClaimStatus.Open,
            filedAt: block.timestamp,
            resolvedAt: 0,
            resolution: ""
        });
        
        // Track claims
        claimsByClaimant[msg.sender].push(claimId);
        claimsAgainstDefendant[defendant].push(claimId);
        
        totalClaimsFiled++;
        
        emit ClaimFiled(claimId, msg.sender, defendant, amount, evidence);
        
        return claimId;
    }
    
    /**
     * @notice Resolve a claim (arbiter only)
     * @param claimId The claim to resolve
     * @param isValid Whether the claim is valid
     * @param resolutionNotes Arbiter's reasoning
     */
    function resolveClaim(
        uint256 claimId,
        bool isValid,
        string calldata resolutionNotes
    ) external validClaimId(claimId) onlyArbiter nonReentrant {
        Claim storage claim = claims[claimId];
        
        if (claim.status != ClaimStatus.Open && claim.status != ClaimStatus.UnderReview) {
            revert ClaimNotOpen();
        }
        
        claim.resolvedAt = block.timestamp;
        claim.resolution = resolutionNotes;
        
        if (isValid) {
            // Claim is valid - slash defendant's bond and pay claimant
            claim.status = ClaimStatus.ResolvedValid;
            
            // Slash defendant's bond
            registry.slashBond(claim.defendant, claim.amount, claim.claimant);
            
            // Return claimant's stake
            bool success = usdc.transfer(claim.claimant, claim.claimantStake);
            if (!success) revert TransferFailed();
            
            // Update reputation
            reputation.recordFailure(claim.defendant);
            reputation.recordSuccess(claim.claimant);
            
            totalPayouts += claim.amount;
            
        } else {
            // Claim is invalid - claimant loses stake
            claim.status = ClaimStatus.ResolvedInvalid;
            
            // Unlock defendant's bond
            registry.unlockBond(claim.defendant, claim.amount);
            
            // Claimant loses stake (stays in contract as protocol fee)
            // Could also be sent to defendant as compensation
            
            // Update reputation (minor penalty for false claim)
            // reputation.recordFailure(claim.claimant); // Optional
        }
        
        totalClaimsResolved++;
        
        emit ClaimResolved(claimId, isValid, isValid ? claim.amount : 0, resolutionNotes);
    }
    
    /**
     * @notice Cancel a claim (claimant only, before resolution)
     * @param claimId The claim to cancel
     */
    function cancelClaim(uint256 claimId) external validClaimId(claimId) nonReentrant {
        Claim storage claim = claims[claimId];
        
        if (claim.claimant != msg.sender) revert NotClaimant();
        if (claim.status != ClaimStatus.Open) revert ClaimNotOpen();
        
        claim.status = ClaimStatus.Cancelled;
        claim.resolvedAt = block.timestamp;
        
        // Unlock defendant's bond
        registry.unlockBond(claim.defendant, claim.amount);
        
        // Return 50% of stake (penalty for wasting time)
        uint256 refund = claim.claimantStake / 2;
        bool success = usdc.transfer(msg.sender, refund);
        if (!success) revert TransferFailed();
        
        emit ClaimCancelled(claimId, msg.sender);
    }
    
    /**
     * @notice Get claim details
     * @param claimId The claim ID
     * @return The claim struct
     */
    function getClaim(uint256 claimId) external view validClaimId(claimId) returns (Claim memory) {
        return claims[claimId];
    }
    
    /**
     * @notice Get all claims filed by an address
     * @param claimant The claimant address
     * @return Array of claim IDs
     */
    function getClaimsByClaimant(address claimant) external view returns (uint256[] memory) {
        return claimsByClaimant[claimant];
    }
    
    /**
     * @notice Get all claims against an address
     * @param defendant The defendant address
     * @return Array of claim IDs
     */
    function getClaimsAgainstDefendant(address defendant) external view returns (uint256[] memory) {
        return claimsAgainstDefendant[defendant];
    }
    
    /**
     * @notice Get protocol statistics
     * @return filed Total claims filed
     * @return resolved Total claims resolved
     * @return payouts Total USDC paid out
     */
    function getStats() external view returns (
        uint256 filed,
        uint256 resolved,
        uint256 payouts
    ) {
        filed = totalClaimsFiled;
        resolved = totalClaimsResolved;
        payouts = totalPayouts;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Add an arbiter
     * @param arbiter The address to add as arbiter
     */
    function addArbiter(address arbiter) external onlyOwner {
        if (arbiter == address(0)) revert InvalidAddress();
        arbiters[arbiter] = true;
        emit ArbiterAdded(arbiter);
    }
    
    /**
     * @notice Remove an arbiter
     * @param arbiter The address to remove
     */
    function removeArbiter(address arbiter) external onlyOwner {
        arbiters[arbiter] = false;
        emit ArbiterRemoved(arbiter);
    }
    
    /**
     * @notice Check if an address is an arbiter
     * @param account The address to check
     * @return Whether the address is an arbiter
     */
    function isArbiter(address account) external view returns (bool) {
        return arbiters[account] || account == owner();
    }
    
    /**
     * @notice Update registry contract
     * @param _registry New registry address
     */
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert InvalidAddress();
        registry = IXyloBondRegistry(_registry);
    }
    
    /**
     * @notice Update reputation contract
     * @param _reputation New reputation address
     */
    function setReputation(address _reputation) external onlyOwner {
        if (_reputation == address(0)) revert InvalidAddress();
        reputation = IXyloBondReputation(_reputation);
    }
    
    /**
     * @notice Withdraw protocol fees (unclaimed stakes)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawFees(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        bool success = usdc.transfer(to, amount);
        if (!success) revert TransferFailed();
    }
}
