// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IXyloBondReputation.sol";

/**
 * @title XyloBondRegistry
 * @author XyloBond Protocol
 * @notice Manages AI agent bond registration and deposits
 * @dev Agents stake USDC as bonds before performing risky actions
 * 
 * Bond Lifecycle:
 * 1. Agent calls postBond() to stake USDC
 * 2. Other agents verify bond status via getBondStatus()
 * 3. If claim filed, bond gets locked via lockBond()
 * 4. If claim valid, bond slashed via slashBond()
 * 5. If no claims, agent can withdrawBond()
 */
contract XyloBondRegistry is Ownable, ReentrancyGuard {
    
    // ============ Constants ============
    
    uint256 public constant MIN_BOND_AMOUNT = 10 * 1e6; // 10 USDC (6 decimals)
    uint256 public constant BASIS_POINTS = 10000;
    
    // ============ State Variables ============
    
    /// @notice USDC token contract
    IERC20 public immutable usdc;
    
    /// @notice Reputation contract
    IXyloBondReputation public reputation;
    
    /// @notice Total bond amount per agent
    mapping(address => uint256) public bonds;
    
    /// @notice Locked portion of bond (under claim)
    mapping(address => uint256) public lockedBonds;
    
    /// @notice Timestamp when bond was posted
    mapping(address => uint256) public bondTimestamp;
    
    /// @notice Active claim count per agent
    mapping(address => uint256) public activeClaimCount;
    
    /// @notice Authorized contracts (Claims contract)
    mapping(address => bool) public authorizedContracts;
    
    /// @notice Protocol statistics
    uint256 public totalBondsDeposited;
    uint256 public totalBondsSlashed;
    uint256 public totalAgentsBonded;
    
    // ============ Events ============
    
    event BondPosted(address indexed agent, uint256 amount, uint256 totalBond);
    event BondWithdrawn(address indexed agent, uint256 amount, uint256 remainingBond);
    event BondLocked(address indexed agent, uint256 amount, uint256 totalLocked);
    event BondUnlocked(address indexed agent, uint256 amount, uint256 totalLocked);
    event BondSlashed(address indexed agent, uint256 amount, address indexed recipient);
    event ContractAuthorized(address indexed contractAddress);
    event ContractRevoked(address indexed contractAddress);
    
    // ============ Errors ============
    
    error InvalidAddress();
    error InvalidAmount();
    error InsufficientBond();
    error InsufficientUnlockedBond();
    error ActiveClaimsExist();
    error NotAuthorized();
    error TransferFailed();
    
    // ============ Modifiers ============
    
    modifier onlyAuthorizedContract() {
        if (!authorizedContracts[msg.sender]) {
            revert NotAuthorized();
        }
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize the registry
     * @param _usdc USDC token address
     * @param _reputation Reputation contract address
     */
    constructor(address _usdc, address _reputation) Ownable(msg.sender) {
        if (_usdc == address(0)) revert InvalidAddress();
        if (_reputation == address(0)) revert InvalidAddress();
        
        usdc = IERC20(_usdc);
        reputation = IXyloBondReputation(_reputation);
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Post a USDC bond
     * @param amount Amount of USDC to bond
     * @dev Agent must approve USDC first
     */
    function postBond(uint256 amount) external nonReentrant {
        if (amount < MIN_BOND_AMOUNT) revert InvalidAmount();
        
        // Track if this is a new bonded agent
        bool isNewAgent = bonds[msg.sender] == 0;
        
        // Transfer USDC from agent to this contract
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        // Update state
        bonds[msg.sender] += amount;
        bondTimestamp[msg.sender] = block.timestamp;
        totalBondsDeposited += amount;
        
        if (isNewAgent) {
            totalAgentsBonded++;
        }
        
        emit BondPosted(msg.sender, amount, bonds[msg.sender]);
    }
    
    /**
     * @notice Withdraw available bond (not locked)
     * @param amount Amount to withdraw
     */
    function withdrawBond(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
        uint256 availableBond = bonds[msg.sender] - lockedBonds[msg.sender];
        if (amount > availableBond) revert InsufficientUnlockedBond();
        
        // Update state before transfer
        bonds[msg.sender] -= amount;
        
        // Transfer USDC back to agent
        bool success = usdc.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
        
        // Update statistics
        if (bonds[msg.sender] == 0) {
            totalAgentsBonded--;
        }
        
        emit BondWithdrawn(msg.sender, amount, bonds[msg.sender]);
    }
    
    /**
     * @notice Get bond status for an agent
     * @param agent The agent address
     * @return totalBond Total bonded amount
     * @return lockedAmount Amount locked under claims
     * @return availableAmount Amount available for withdrawal
     * @return timestamp When bond was posted
     * @return isBonded Whether agent has an active bond
     */
    function getBondStatus(address agent) external view returns (
        uint256 totalBond,
        uint256 lockedAmount,
        uint256 availableAmount,
        uint256 timestamp,
        bool isBonded
    ) {
        totalBond = bonds[agent];
        lockedAmount = lockedBonds[agent];
        availableAmount = totalBond - lockedAmount;
        timestamp = bondTimestamp[agent];
        isBonded = totalBond > 0;
    }
    
    /**
     * @notice Get the bond amount for an agent
     * @param agent The agent address
     * @return The total bond amount
     */
    function getBondAmount(address agent) external view returns (uint256) {
        return bonds[agent];
    }
    
    /**
     * @notice Check if an agent is bonded
     * @param agent The agent address
     * @return Whether the agent has a bond
     */
    function isBonded(address agent) external view returns (bool) {
        return bonds[agent] > 0;
    }
    
    /**
     * @notice Calculate required bond for an agent (considering reputation)
     * @param agent The agent address
     * @param baseAmount The base bond amount
     * @return The required bond amount after reputation adjustment
     */
    function calculateRequiredBond(address agent, uint256 baseAmount) external view returns (uint256) {
        uint256 multiplier = reputation.getRequiredBondMultiplier(agent);
        return (baseAmount * multiplier) / BASIS_POINTS;
    }
    
    /**
     * @notice Check if agent has sufficient bond for an amount
     * @param agent The agent address
     * @param amount The required amount
     * @return Whether the agent has sufficient available bond
     */
    function hasSufficientBond(address agent, uint256 amount) external view returns (bool) {
        uint256 available = bonds[agent] - lockedBonds[agent];
        return available >= amount;
    }
    
    // ============ Authorized Contract Functions ============
    
    /**
     * @notice Lock a portion of agent's bond (called by Claims contract)
     * @param agent The agent whose bond to lock
     * @param amount Amount to lock
     */
    function lockBond(address agent, uint256 amount) external onlyAuthorizedContract {
        if (agent == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        
        uint256 available = bonds[agent] - lockedBonds[agent];
        if (amount > available) revert InsufficientUnlockedBond();
        
        lockedBonds[agent] += amount;
        activeClaimCount[agent]++;
        
        emit BondLocked(agent, amount, lockedBonds[agent]);
    }
    
    /**
     * @notice Unlock a portion of agent's bond (claim resolved)
     * @param agent The agent whose bond to unlock
     * @param amount Amount to unlock
     */
    function unlockBond(address agent, uint256 amount) external onlyAuthorizedContract {
        if (agent == address(0)) revert InvalidAddress();
        if (amount > lockedBonds[agent]) revert InvalidAmount();
        
        lockedBonds[agent] -= amount;
        if (activeClaimCount[agent] > 0) {
            activeClaimCount[agent]--;
        }
        
        emit BondUnlocked(agent, amount, lockedBonds[agent]);
    }
    
    /**
     * @notice Slash agent's bond and send to recipient (valid claim)
     * @param agent The agent whose bond to slash
     * @param amount Amount to slash
     * @param recipient Who receives the slashed amount
     */
    function slashBond(address agent, uint256 amount, address recipient) external onlyAuthorizedContract nonReentrant {
        if (agent == address(0) || recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (amount > lockedBonds[agent]) revert InsufficientBond();
        
        // Update state
        lockedBonds[agent] -= amount;
        bonds[agent] -= amount;
        totalBondsSlashed += amount;
        
        if (activeClaimCount[agent] > 0) {
            activeClaimCount[agent]--;
        }
        
        // Transfer slashed amount to recipient
        bool success = usdc.transfer(recipient, amount);
        if (!success) revert TransferFailed();
        
        // Update bonded count if needed
        if (bonds[agent] == 0) {
            totalAgentsBonded--;
        }
        
        emit BondSlashed(agent, amount, recipient);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Authorize a contract to manage bonds (e.g., Claims contract)
     * @param contractAddress The contract to authorize
     */
    function authorizeContract(address contractAddress) external onlyOwner {
        if (contractAddress == address(0)) revert InvalidAddress();
        authorizedContracts[contractAddress] = true;
        emit ContractAuthorized(contractAddress);
    }
    
    /**
     * @notice Revoke contract authorization
     * @param contractAddress The contract to revoke
     */
    function revokeContract(address contractAddress) external onlyOwner {
        authorizedContracts[contractAddress] = false;
        emit ContractRevoked(contractAddress);
    }
    
    /**
     * @notice Update reputation contract address
     * @param _reputation New reputation contract
     */
    function setReputationContract(address _reputation) external onlyOwner {
        if (_reputation == address(0)) revert InvalidAddress();
        reputation = IXyloBondReputation(_reputation);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get protocol statistics
     * @return deposited Total USDC deposited as bonds
     * @return slashed Total USDC slashed from bonds
     * @return agents Total number of bonded agents
     */
    function getProtocolStats() external view returns (
        uint256 deposited,
        uint256 slashed,
        uint256 agents
    ) {
        deposited = totalBondsDeposited;
        slashed = totalBondsSlashed;
        agents = totalAgentsBonded;
    }
}
