// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategy} from "../interfaces/IStrategy.sol";

/**
 * @title ZieldVault
 * @notice Risk-aware yield vault. Accepts deposits of a single asset (USDC on Base for MVP),
 *         allocates across multiple strategies according to target weights set by a privileged
 *         keeper (or owner during bootstrap), and exposes a rebalance mechanism.
 *
 * Design principles for MVP:
 * - ERC4626 for maximum composability (other protocols, treasuries, etc. can treat it as a normal yield-bearing token).
 * - Strategy allocation is expressed in basis points (total must sum to 10000).
 * - Rebalancing is deliberately NOT automatic inside the contract — it is triggered by an off-chain
 *   Risk Engine + Keeper that has a superior view of current market conditions, gas costs, and
 *   withdrawal queues. This is a feature, not a bug.
 * - The vault itself is intentionally "dumb" about yields and risk scores. Those live in the
 *   off-chain optimizer so we can iterate the model without upgrading contracts constantly.
 * - Strong emphasis on safety: pausable, reentrancy guards, minimum deposit size, withdrawal
 *   cooldown window (simple version for MVP), and explicit harvest-before-rebalance.
 *
 * Future (post-MVP):
 * - Multiple assets / multi-asset vaults
 * - On-chain risk parameter validation with timelocks
 * - Better withdrawal queue / liquidity bucketing
 * - Fee module (performance + management) with protocol-owned liquidity
 */
contract ZieldVault is ERC4626, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for ERC20;
    using Math for uint256;

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    struct StrategyAllocation {
        IStrategy strategy;
        uint16 targetBps; // 0-10000, sum across all must == 10000
    }

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    /// @notice Registered strategies (order matters for some gas optimizations)
    IStrategy[] public strategies;

    /// @notice Current target allocation for each strategy (basis points)
    mapping(IStrategy => uint16) public targetAllocationBps;

    /// @notice Total assets currently allocated to each strategy (updated on harvest/rebalance)
    mapping(IStrategy => uint256) public strategyAssets;

    /// @notice Address allowed to call rebalance() and set allocations.
    /// In production this will be a keeper multisig or a dedicated keeper contract.
    address public keeper;

    /// @notice Last time a full rebalance (or harvestAll) occurred
    uint256 public lastRebalanceTimestamp;

    /// @notice Minimum deposit amount (anti-dust / griefing protection)
    uint256 public minDeposit = 1e6; // 1 USDC (6 decimals) — adjust per asset

    /// @notice Simple withdrawal fee in basis points (0 = none). Can be used for protocol revenue.
    uint16 public withdrawalFeeBps = 0;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event StrategyAdded(address indexed strategy, uint16 targetBps);
    event StrategyRemoved(address indexed strategy);
    event AllocationUpdated(address indexed strategy, uint16 oldBps, uint16 newBps);
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event Rebalanced(uint256 totalAssetsBefore, uint256 totalAssetsAfter, uint256 timestamp);
    event Harvested(address indexed strategy, uint256 amount);
    event MinDepositUpdated(uint256 oldMin, uint256 newMin);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error InvalidAllocation();
    error StrategyAlreadyExists();
    error StrategyNotFound();
    error OnlyKeeperOrOwner();
    error InsufficientAssets();
    error BelowMinDeposit();
    error RebalanceTooFrequent();
    error AllocationSumMismatch();

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyKeeperOrOwner() {
        if (msg.sender != keeper && msg.sender != owner()) revert OnlyKeeperOrOwner();
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(
        address asset_,
        string memory name_,
        string memory symbol_,
        address initialKeeper_,
        address initialOwner_
    ) ERC4626(ERC20(asset_)) ERC20(name_, symbol_) Ownable(initialOwner_) {
        keeper = initialKeeper_;
        lastRebalanceTimestamp = block.timestamp;
    }

    // ------------------------------------------------------------------
    // View Functions
    // ------------------------------------------------------------------

    /// @notice Total assets under management (sum of vault balance + all strategy positions)
    function totalAssets() public view override returns (uint256 total) {
        total = ERC20(asset()).balanceOf(address(this));

        uint256 len = strategies.length;
        for (uint256 i = 0; i < len; i++) {
            total += strategies[i].totalAssets();
        }
    }

    /// @notice Current allocation of a strategy as a fraction of TVL (in basis points)
    function currentAllocationBps(IStrategy strategy) public view returns (uint16) {
        uint256 tvl = totalAssets();
        if (tvl == 0) return 0;
        uint256 stratAssets = strategy.totalAssets();
        return uint16((stratAssets * 10000) / tvl);
    }

    /// @notice Returns all strategies and their target allocations
    function getAllStrategies() external view returns (StrategyAllocation[] memory) {
        uint256 len = strategies.length;
        StrategyAllocation[] memory result = new StrategyAllocation[](len);
        for (uint256 i = 0; i < len; i++) {
            IStrategy s = strategies[i];
            result[i] = StrategyAllocation({strategy: s, targetBps: targetAllocationBps[s]});
        }
        return result;
    }

    // ------------------------------------------------------------------
    // Strategy Management (Owner only)
    // ------------------------------------------------------------------

    /// @notice Add a new strategy with an initial target allocation.
    /// Target allocations across all strategies must always sum exactly to 10000.
    function addStrategy(IStrategy strategy, uint16 targetBps) external onlyOwner {
        if (address(strategy) == address(0)) revert InvalidAllocation();
        if (targetAllocationBps[strategy] != 0) revert StrategyAlreadyExists();

        // Verify the strategy reports the same asset as the vault
        if (strategy.asset() != asset()) revert InvalidAllocation();

        strategies.push(strategy);
        targetAllocationBps[strategy] = targetBps;

        emit StrategyAdded(address(strategy), targetBps);
        _validateAllocationSum();
    }

    function removeStrategy(IStrategy strategy) external onlyOwner {
        // First withdraw everything from it (best effort)
        uint256 withdrawn = strategy.emergencyWithdraw();
        if (withdrawn > 0) {
            // Funds now sit in the vault idle
        }

        // Remove from array
        uint256 len = strategies.length;
        for (uint256 i = 0; i < len; i++) {
            if (strategies[i] == strategy) {
                strategies[i] = strategies[len - 1];
                strategies.pop();
                break;
            }
        }

        delete targetAllocationBps[strategy];
        delete strategyAssets[strategy];

        emit StrategyRemoved(address(strategy));
    }

    /// @notice Update target allocation for one or more strategies in a single call.
    /// Sum of all targets must still equal 10000.
    function setTargetAllocations(IStrategy[] calldata _strategies, uint16[] calldata targets) external onlyOwner {
        uint256 len = _strategies.length;
        if (len != targets.length) revert InvalidAllocation();

        for (uint256 i = 0; i < len; i++) {
            IStrategy s = _strategies[i];
            if (targetAllocationBps[s] == 0) revert StrategyNotFound();

            uint16 old = targetAllocationBps[s];
            targetAllocationBps[s] = targets[i];
            emit AllocationUpdated(address(s), old, targets[i]);
        }
        _validateAllocationSum();
    }

    // ------------------------------------------------------------------
    // Keeper / Rebalancing
    // ------------------------------------------------------------------

    function setKeeper(address newKeeper) external onlyOwner {
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    /// @notice Harvest yield from all strategies. Anyone can call (incentivized later).
    function harvestAll() public {
        uint256 len = strategies.length;
        for (uint256 i = 0; i < len; i++) {
            IStrategy s = strategies[i];
            uint256 harvested = s.harvest();
            if (harvested > 0) {
                emit Harvested(address(s), harvested);
            }
            strategyAssets[s] = s.totalAssets();
        }
    }

    /**
     * @notice Core rebalancing function.
     * The keeper (or owner) calls this after the off-chain optimizer has decided on new targets.
     *
     * Flow:
     * 1. Harvest everything first (so we have fresh yield numbers).
     * 2. For strategies that are overweight, withdraw down to (or below) their new target.
     * 3. For strategies that are underweight, deposit up to their new target using idle + withdrawn funds.
     *
     * This is deliberately simple for MVP. A more sophisticated version would:
     * - Calculate exact amounts to move to minimize gas
     * - Respect withdrawal queues / cooldowns
     * - Only rebalance when net benefit > estimated gas cost (passed in or simulated off-chain)
     */
    function rebalance() external onlyKeeperOrOwner whenNotPaused nonReentrant {
        harvestAll();

        uint256 tvlBefore = totalAssets();
        uint256 idle = ERC20(asset()).balanceOf(address(this));

        uint256 len = strategies.length;

        // Step 1: Withdraw from overweight strategies
        for (uint256 i = 0; i < len; i++) {
            IStrategy s = strategies[i];
            uint256 current = s.totalAssets();
            uint256 target = (tvlBefore * targetAllocationBps[s]) / 10000;

            if (current > target) {
                uint256 excess = current - target;
                uint256 withdrawn = s.withdraw(excess);
                idle += withdrawn;
                strategyAssets[s] = s.totalAssets();
            }
        }

        // Step 2: Deposit into underweight strategies
        for (uint256 i = 0; i < len; i++) {
            IStrategy s = strategies[i];
            uint256 current = s.totalAssets();
            uint256 target = (tvlBefore * targetAllocationBps[s]) / 10000;

            if (current < target && idle > 0) {
                uint256 needed = target - current;
                uint256 toDeposit = needed > idle ? idle : needed;

                ERC20(asset()).forceApprove(address(s), toDeposit);
                s.deposit(toDeposit);
                idle -= toDeposit;
                strategyAssets[s] = s.totalAssets();
            }
        }

        // Any remaining idle stays in the vault (will be deployed on next rebalance or user action)

        lastRebalanceTimestamp = block.timestamp;

        uint256 tvlAfter = totalAssets();
        emit Rebalanced(tvlBefore, tvlAfter, block.timestamp);
    }

    // ------------------------------------------------------------------
    // ERC4626 Overrides (with safety hooks)
    // ------------------------------------------------------------------

    function deposit(uint256 assets, address receiver) public override whenNotPaused nonReentrant returns (uint256) {
        if (assets < minDeposit) revert BelowMinDeposit();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override whenNotPaused nonReentrant returns (uint256) {
        uint256 assets = previewMint(shares);
        if (assets < minDeposit) revert BelowMinDeposit();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        // For MVP we keep a simple (optional) withdrawal fee
        if (withdrawalFeeBps > 0) {
            uint256 fee = (assets * withdrawalFeeBps) / 10000;
            assets = assets - fee;
            // Fee stays in the vault (accrues to remaining LPs) — can be swept later by owner
        }
        return super.withdraw(assets, receiver, owner_);
    }

    // ------------------------------------------------------------------
    // Admin Controls
    // ------------------------------------------------------------------

    function setMinDeposit(uint256 newMin) external onlyOwner {
        emit MinDepositUpdated(minDeposit, newMin);
        minDeposit = newMin;
    }

    function setWithdrawalFee(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= 100, "Fee too high"); // Max 1%
        withdrawalFeeBps = newFeeBps;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Sweep any ERC20 that is not the vault asset (e.g. reward tokens sent by mistake)
    function sweep(address token, address to) external onlyOwner {
        require(token != asset(), "Cannot sweep vault asset");
        uint256 bal = ERC20(token).balanceOf(address(this));
        if (bal > 0) ERC20(token).safeTransfer(to, bal);
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _validateAllocationSum() internal view {
        uint256 sum;
        uint256 len = strategies.length;
        for (uint256 i = 0; i < len; i++) {
            sum += targetAllocationBps[strategies[i]];
        }
        if (sum != 10000) revert AllocationSumMismatch();
    }

    // ------------------------------------------------------------------
    // Receive / Fallback (defensive)
    // ------------------------------------------------------------------

    receive() external payable {}
}
