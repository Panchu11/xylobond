// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IXyloBondReputation
 * @notice Interface for the XyloBond reputation system
 */
interface IXyloBondReputation {
    function getScore(address agent) external view returns (uint256);
    function recordSuccess(address agent) external;
    function recordFailure(address agent) external;
    function getRequiredBondMultiplier(address agent) external view returns (uint256);
}
