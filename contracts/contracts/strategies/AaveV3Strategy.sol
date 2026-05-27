// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AaveV3Strategy
 * @notice Strategy adapter for supplying an asset to Aave v3 and earning variable yield.
 *
 * MVP notes:
 * - Uses the Aave Pool contract directly (no need for aTokens in most flows).
 * - `estimatedAPY()` returns a static value for now. In later versions we will
 *   read the real current supply rate from Aave's rate provider or use an
 *   off-chain updated value stored in the contract.
 * - This is intentionally minimal. Production versions should handle:
 *     - Aave incentives (rewards)
 *     - Supply caps
 *     - eMode / isolation mode if relevant
 *     - More precise APY calculation
 */
contract AaveV3Strategy is IStrategy, Ownable {
    using SafeERC20 for IERC20;

    address public immutable override asset;
    address public immutable aavePool;
    address public immutable aToken; // aToken address for the asset (used for balance checks)

    uint256 private _lastHarvest;

    // Risk and yield parameters (owner/governance updatable for MVP)
    uint8 public override riskScore = 15; // Low risk for Aave bluechip markets (example)
    uint256 public override estimatedAPY = 450; // 4.5% in bps — updated off-chain or via oracle later

    constructor(
        address asset_,
        address aavePool_,
        address aToken_,
        address initialOwner_
    ) Ownable(initialOwner_) {
        asset = asset_;
        aavePool = aavePool_;
        aToken = aToken_;
    }

    // ------------------------------------------------------------------
    // IStrategy Implementation
    // ------------------------------------------------------------------

    function totalAssets() public view override returns (uint256) {
        // aToken balanceOf is the principal + accrued interest
        return IERC20(aToken).balanceOf(address(this));
    }

    function deposit(uint256 amount) external override returns (uint256 shares) {
        require(amount > 0, "Zero amount");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).forceApprove(aavePool, amount);

        // Aave v3 Pool supply signature: supply(asset, amount, onBehalfOf, referralCode)
        (bool success, ) = aavePool.call(
            abi.encodeWithSignature("supply(address,uint256,address,uint16)", asset, amount, address(this), 0)
        );
        require(success, "Aave supply failed");

        // For aTokens, 1:1 with asset in most cases (ignoring rounding for MVP)
        shares = amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        require(amount > 0, "Zero amount");

        // Aave withdraw signature: withdraw(asset, amount, to)
        (bool success, bytes memory ret) = aavePool.call(
            abi.encodeWithSignature("withdraw(address,uint256,address)", asset, amount, msg.sender)
        );
        require(success, "Aave withdraw failed");

        withdrawn = abi.decode(ret, (uint256));
    }

    function harvest() external override returns (uint256 harvested) {
        // Aave variable yield accrues automatically in aToken balance.
        // For real reward tokens (e.g. AAVE incentives on some markets) we would claim here.
        // For MVP we just report the increase since last harvest.
        uint256 before = totalAssets();
        _lastHarvest = block.timestamp;

        uint256 after_ = totalAssets();
        if (after_ > before) {
            harvested = after_ - before;
        }
        // In a real implementation we might also swap incentives to asset here.
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        uint256 bal = totalAssets();
        if (bal == 0) return 0;

        (bool success, bytes memory ret) = aavePool.call(
            abi.encodeWithSignature("withdraw(address,uint256,address)", asset, type(uint256).max, msg.sender)
        );
        require(success, "Aave emergency withdraw failed");

        withdrawn = abi.decode(ret, (uint256));
    }

    function isActive() external view override returns (bool) {
        // Could add checks for Aave pool paused, supply cap reached, etc.
        return true;
    }

    // ------------------------------------------------------------------
    // Admin (MVP — will move to timelock / risk council post-MVP)
    // ------------------------------------------------------------------

    function setRiskScore(uint8 newScore) external onlyOwner {
        require(newScore <= 100, "Risk too high");
        riskScore = newScore;
    }

    function setEstimatedAPY(uint256 newAPYBps) external onlyOwner {
        estimatedAPY = newAPYBps;
    }
}
