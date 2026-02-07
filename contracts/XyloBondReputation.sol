// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title XyloBondReputation
 * @author XyloBond Protocol
 * @notice On-chain reputation system for AI agents
 * @dev Tracks agent reputation scores (0-100) that affect bond requirements
 * 
 * Reputation Tiers:
 * - 80-100: Excellent (50% bond discount)
 * - 60-79:  Good (25% bond discount)
 * - 40-59:  Neutral (standard bond)
 * - 20-39:  Poor (50% bond premium)
 * - 0-19:   Bad (100% bond premium)
 */
contract XyloBondReputation is Ownable, ReentrancyGuard {
    
    // ============ Constants ============
    
    uint256 public constant DEFAULT_SCORE = 50;
    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MIN_SCORE = 0;
    
    uint256 public constant SUCCESS_POINTS = 5;
    uint256 public constant FAILURE_POINTS = 10;
    
    // Multiplier basis points (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;
    
    // ============ State Variables ============
    
    /// @notice Reputation score for each agent (0-100)
    mapping(address => uint256) public scores;
    
    /// @notice Whether an agent has been initialized
    mapping(address => bool) public initialized;
    
    /// @notice Total successful transactions per agent
    mapping(address => uint256) public successCount;
    
    /// @notice Total failed transactions (claims against) per agent
    mapping(address => uint256) public failureCount;
    
    /// @notice Authorized contracts that can update reputation
    mapping(address => bool) public authorizedUpdaters;
    
    // ============ Events ============
    
    event ReputationInitialized(address indexed agent, uint256 score);
    event ReputationIncreased(address indexed agent, uint256 oldScore, uint256 newScore, string reason);
    event ReputationDecreased(address indexed agent, uint256 oldScore, uint256 newScore, string reason);
    event UpdaterAuthorized(address indexed updater);
    event UpdaterRevoked(address indexed updater);
    
    // ============ Errors ============
    
    error NotAuthorized();
    error InvalidAddress();
    
    // ============ Modifiers ============
    
    modifier onlyAuthorized() {
        if (!authorizedUpdaters[msg.sender] && msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }
    
    // ============ Constructor ============
    
    constructor() Ownable(msg.sender) {}
    
    // ============ External Functions ============
    
    /**
     * @notice Get an agent's reputation score
     * @param agent The agent address
     * @return The reputation score (0-100)
     */
    function getScore(address agent) external view returns (uint256) {
        if (!initialized[agent]) {
            return DEFAULT_SCORE;
        }
        return scores[agent];
    }
    
    /**
     * @notice Get the bond multiplier based on reputation
     * @param agent The agent address
     * @return Multiplier in basis points (10000 = 100%)
     * @dev Higher reputation = lower required bond
     */
    function getRequiredBondMultiplier(address agent) external view returns (uint256) {
        uint256 score = initialized[agent] ? scores[agent] : DEFAULT_SCORE;
        
        if (score >= 80) {
            return 5000; // 50% of standard
        } else if (score >= 60) {
            return 7500; // 75% of standard
        } else if (score >= 40) {
            return 10000; // 100% (standard)
        } else if (score >= 20) {
            return 15000; // 150% of standard
        } else {
            return 20000; // 200% of standard
        }
    }
    
    /**
     * @notice Record a successful transaction/service completion
     * @param agent The agent to credit
     */
    function recordSuccess(address agent) external onlyAuthorized nonReentrant {
        if (agent == address(0)) revert InvalidAddress();
        
        _initializeIfNeeded(agent);
        
        uint256 oldScore = scores[agent];
        uint256 newScore = oldScore + SUCCESS_POINTS;
        
        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        }
        
        scores[agent] = newScore;
        successCount[agent]++;
        
        emit ReputationIncreased(agent, oldScore, newScore, "Successful transaction");
    }
    
    /**
     * @notice Record a failure (valid claim against agent)
     * @param agent The agent to penalize
     */
    function recordFailure(address agent) external onlyAuthorized nonReentrant {
        if (agent == address(0)) revert InvalidAddress();
        
        _initializeIfNeeded(agent);
        
        uint256 oldScore = scores[agent];
        uint256 newScore;
        
        if (oldScore <= FAILURE_POINTS) {
            newScore = MIN_SCORE;
        } else {
            newScore = oldScore - FAILURE_POINTS;
        }
        
        scores[agent] = newScore;
        failureCount[agent]++;
        
        emit ReputationDecreased(agent, oldScore, newScore, "Valid claim against");
    }
    
    /**
     * @notice Get agent statistics
     * @param agent The agent address
     * @return score Current reputation score
     * @return successes Total successful transactions
     * @return failures Total failures (valid claims against)
     * @return multiplier Bond multiplier in basis points
     */
    function getAgentStats(address agent) external view returns (
        uint256 score,
        uint256 successes,
        uint256 failures,
        uint256 multiplier
    ) {
        score = initialized[agent] ? scores[agent] : DEFAULT_SCORE;
        successes = successCount[agent];
        failures = failureCount[agent];
        multiplier = this.getRequiredBondMultiplier(agent);
    }
    
    /**
     * @notice Get reputation tier name
     * @param agent The agent address
     * @return tier The tier name as a string
     */
    function getTier(address agent) external view returns (string memory tier) {
        uint256 score = initialized[agent] ? scores[agent] : DEFAULT_SCORE;
        
        if (score >= 80) {
            return "Excellent";
        } else if (score >= 60) {
            return "Good";
        } else if (score >= 40) {
            return "Neutral";
        } else if (score >= 20) {
            return "Poor";
        } else {
            return "Bad";
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Authorize a contract to update reputation
     * @param updater The address to authorize
     */
    function authorizeUpdater(address updater) external onlyOwner {
        if (updater == address(0)) revert InvalidAddress();
        authorizedUpdaters[updater] = true;
        emit UpdaterAuthorized(updater);
    }
    
    /**
     * @notice Revoke authorization from a contract
     * @param updater The address to revoke
     */
    function revokeUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = false;
        emit UpdaterRevoked(updater);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Initialize an agent's reputation if not already done
     * @param agent The agent address
     */
    function _initializeIfNeeded(address agent) internal {
        if (!initialized[agent]) {
            scores[agent] = DEFAULT_SCORE;
            initialized[agent] = true;
            emit ReputationInitialized(agent, DEFAULT_SCORE);
        }
    }
}
