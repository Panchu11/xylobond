// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IXyloBondRegistry
 * @notice Interface for the XyloBond registry
 */
interface IXyloBondRegistry {
    function getBondAmount(address agent) external view returns (uint256);
    function isBonded(address agent) external view returns (bool);
    function lockBond(address agent, uint256 amount) external;
    function unlockBond(address agent, uint256 amount) external;
    function slashBond(address agent, uint256 amount, address recipient) external;
}
