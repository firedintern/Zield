// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockYieldStrategy
 * @notice Test/demonstration strategy that holds the asset and "accrues" yield over time.
 * Used for rapid iteration on the vault + rebalancing + risk engine loop before (or alongside)
 * wiring real protocols.
 *
 * It deliberately lets the tester control the APY and risk score so the optimizer behavior
 * can be validated deterministically.
 */
contract MockYieldStrategy is IStrategy, Ownable {
    using SafeERC20 for IERC20;

    address public immutable override asset;

    uint256 private _totalAssets;
    uint256 private _lastAccrual;

    // Controllable parameters (for testing the optimizer + keeper)
    uint256 public override estimatedAPY; // in bps
    uint8 public override riskScore;

    uint256 public constant SECONDS_PER_YEAR = 365 days;

    constructor(
        address asset_,
        uint256 initialAPYBps,
        uint8 initialRisk,
        address initialOwner_
    ) Ownable(initialOwner_) {
        asset = asset_;
        estimatedAPY = initialAPYBps;
        riskScore = initialRisk;
        _lastAccrual = block.timestamp;
    }

    function totalAssets() public view override returns (uint256) {
        return _accruedAssets();
    }

    function _accruedAssets() internal view returns (uint256) {
        if (_totalAssets == 0) return 0;

        uint256 timeElapsed = block.timestamp - _lastAccrual;
        if (timeElapsed == 0) return _totalAssets;

        // Simple linear accrual for testing: (APY / 10000) * (time / year) * principal
        uint256 yield = (_totalAssets * estimatedAPY * timeElapsed) / (10000 * SECONDS_PER_YEAR);
        return _totalAssets + yield;
    }

    function deposit(uint256 amount) external override returns (uint256 shares) {
        require(amount > 0, "Zero deposit");
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        // Force accrual before changing principal
        _accrue();
        _totalAssets += amount;
        shares = amount; // 1:1 for simplicity
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        _accrue();
        uint256 available = _totalAssets;
        withdrawn = amount > available ? available : amount;

        if (withdrawn > 0) {
            _totalAssets -= withdrawn;
            IERC20(asset).safeTransfer(msg.sender, withdrawn);
        }
    }

    function harvest() external override returns (uint256 harvested) {
        uint256 before = _totalAssets;
        _accrue();
        harvested = _totalAssets > before ? _totalAssets - before : 0;
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        _accrue();
        withdrawn = _totalAssets;
        if (withdrawn > 0) {
            _totalAssets = 0;
            IERC20(asset).safeTransfer(msg.sender, withdrawn);
        }
    }

    function isActive() external pure override returns (bool) {
        return true;
    }

    // ------------------------------------------------------------------
    // Test / Keeper Controls (remove or protect in production)
    // ------------------------------------------------------------------

    function setEstimatedAPY(uint256 newAPYBps) external onlyOwner {
        _accrue();
        estimatedAPY = newAPYBps;
    }

    function setRiskScore(uint8 newScore) external onlyOwner {
        require(newScore <= 100, "Invalid risk");
        riskScore = newScore;
    }

    function _accrue() internal {
        if (_totalAssets == 0) {
            _lastAccrual = block.timestamp;
            return;
        }
        _totalAssets = _accruedAssets();
        _lastAccrual = block.timestamp;
    }
}
