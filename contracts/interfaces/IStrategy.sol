// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IStrategy
 * @notice Interface for Zield yield strategies.
 * Each strategy wraps a specific DeFi opportunity (Aave, Morpho, Aerodrome LP, Pendle, etc.).
 * The vault calls these methods to allocate, harvest, and withdraw capital.
 *
 * Security notes for implementers:
 * - Strategies must never hold user funds directly except during the brief execution window.
 * - All external calls must be carefully checked for reentrancy.
 * - Harvest should be idempotent and return the actual amount of asset harvested.
 */
interface IStrategy {
    /// @notice The underlying asset this strategy accepts and returns (e.g. USDC)
    function asset() external view returns (address);

    /// @notice Current total assets managed by this strategy (in asset terms, after accrued yield)
    function totalAssets() external view returns (uint256);

    /// @notice Estimated net APY (in basis points, e.g. 850 = 8.5%). Used by off-chain optimizer.
    /// This is a *view* that can be expensive; keeper should cache it.
    function estimatedAPY() external view returns (uint256 apyBps);

    /// @notice Risk score for this strategy (0-100, lower is safer). Used by optimizer.
    /// Should be relatively stable; updated only by governance or risk council.
    function riskScore() external view returns (uint8);

    /// @notice Deposit `amount` of asset into the strategy. Caller must have approved the asset.
    /// @return shares Amount of strategy shares/position tokens received (implementation specific).
    function deposit(uint256 amount) external returns (uint256 shares);

    /// @notice Withdraw `amount` of asset from the strategy back to the caller (usually the vault).
    /// @return withdrawn The actual amount of asset sent back (may be less due to locks/fees in some protocols).
    function withdraw(uint256 amount) external returns (uint256 withdrawn);

    /// @notice Harvest any pending rewards/yield and convert to the underlying asset if needed.
    /// @return harvested The amount of asset newly available from this harvest.
    function harvest() external returns (uint256 harvested);

    /// @notice Emergency function: withdraw *everything* possible back to caller.
    /// Used during rebalancing or if the strategy is deprecated.
    function emergencyWithdraw() external returns (uint256 withdrawn);

    /// @notice Whether the strategy is currently healthy and accepting new deposits.
    function isActive() external view returns (bool);
}
