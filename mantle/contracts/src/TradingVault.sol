// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TradingVault
 * @notice Vault for AI quant trading strategies on Mantle — manages MNT and mETH positions
 * @dev Agent-controlled execution with daily loss limits and position tracking
 */
contract TradingVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Mantle Token Addresses ────────────────────────────────────────────────
    address public constant MNT_NATIVE = address(0);
    address public constant METH_TOKEN = 0xcDA86A272531e8640cD7F1a92c01839911B90bb0;

    // ─── Roles ─────────────────────────────────────────────────────────────────
    address public agent;
    mapping(address => bool) public authorizedStrategists;

    // ─── Risk Parameters ───────────────────────────────────────────────────────
    uint256 public dailyLossLimitBps; // basis points, e.g. 500 = 5%
    int256 public dailyPnl;           // cumulative daily PnL in USD equivalent (18 decimals)
    uint256 public dayStart;
    bool public tradingHalted;

    // ─── Position Tracking ─────────────────────────────────────────────────────
    struct Position {
        address token;
        uint256 size;        // token amount
        uint256 entryPrice;  // price in USD * 1e18
        uint256 openedAt;
        bool isLong;
        bool open;
        string strategy;
    }

    mapping(bytes32 => Position) public openPositions;
    bytes32[] public positionIds;
    uint256 public totalPositions;

    // ─── Depositor Tracking ────────────────────────────────────────────────────
    mapping(address => uint256) public mntDeposits;
    mapping(address => uint256) public methDeposits;
    uint256 public totalMntDeposited;
    uint256 public totalMethDeposited;

    // ─── Strategy Execution Log ────────────────────────────────────────────────
    struct StrategyExecution {
        address target;
        uint256 amount;
        string strategyName;
        uint256 timestamp;
        bool success;
        bytes returnData;
    }
    StrategyExecution[] public executionLog;

    // ─── Events ────────────────────────────────────────────────────────────────
    event Deposited(address indexed depositor, address indexed token, uint256 amount);
    event Withdrawn(address indexed depositor, address indexed token, uint256 amount);
    event StrategyExecuted(
        address indexed target,
        uint256 amount,
        string strategyName,
        bool success
    );
    event PositionOpened(
        bytes32 indexed positionId,
        address indexed token,
        uint256 size,
        uint256 entryPrice,
        bool isLong,
        string strategy
    );
    event PositionClosed(
        bytes32 indexed positionId,
        uint256 exitPrice,
        int256 pnl
    );
    event LossLimitHit(int256 dailyPnl, uint256 limit);
    event TradingHalted(address indexed by);
    event TradingResumed(address indexed by);
    event DailyPnlUpdated(int256 pnl);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);

    // ─── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyAgent() {
        require(
            msg.sender == agent || authorizedStrategists[msg.sender],
            "TradingVault: caller is not agent"
        );
        _;
    }

    modifier tradingActive() {
        require(!tradingHalted, "TradingVault: trading is halted");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address _agent,
        uint256 _dailyLossLimitBps
    ) Ownable(msg.sender) {
        require(_agent != address(0), "TradingVault: zero agent");
        require(_dailyLossLimitBps <= 2000, "TradingVault: loss limit too high"); // max 20%

        agent = _agent;
        dailyLossLimitBps = _dailyLossLimitBps;
        dayStart = block.timestamp;
    }

    // ─── Deposits ──────────────────────────────────────────────────────────────
    receive() external payable {
        mntDeposits[msg.sender] += msg.value;
        totalMntDeposited += msg.value;
        emit Deposited(msg.sender, MNT_NATIVE, msg.value);
    }

    function depositMNT() external payable {
        require(msg.value > 0, "TradingVault: zero deposit");
        mntDeposits[msg.sender] += msg.value;
        totalMntDeposited += msg.value;
        emit Deposited(msg.sender, MNT_NATIVE, msg.value);
    }

    function depositMETH(uint256 amount) external nonReentrant {
        require(amount > 0, "TradingVault: zero deposit");
        IERC20(METH_TOKEN).safeTransferFrom(msg.sender, address(this), amount);
        methDeposits[msg.sender] += amount;
        totalMethDeposited += amount;
        emit Deposited(msg.sender, METH_TOKEN, amount);
    }

    // ─── Withdrawals ───────────────────────────────────────────────────────────
    function withdrawMNT(uint256 amount) external nonReentrant {
        require(mntDeposits[msg.sender] >= amount, "TradingVault: insufficient MNT balance");
        mntDeposits[msg.sender] -= amount;
        totalMntDeposited -= amount;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "TradingVault: MNT transfer failed");
        emit Withdrawn(msg.sender, MNT_NATIVE, amount);
    }

    function withdrawMETH(uint256 amount) external nonReentrant {
        require(methDeposits[msg.sender] >= amount, "TradingVault: insufficient mETH balance");
        methDeposits[msg.sender] -= amount;
        totalMethDeposited -= amount;
        IERC20(METH_TOKEN).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, METH_TOKEN, amount);
    }

    // ─── Strategy Execution ────────────────────────────────────────────────────

    /**
     * @notice Execute a trading strategy via agent
     * @param target DEX router or protocol contract
     * @param data Encoded calldata for the strategy
     * @param amount Amount of native MNT to send
     * @param strategyName Human-readable strategy name for logging
     */
    function executeStrategy(
        address target,
        bytes calldata data,
        uint256 amount,
        string calldata strategyName
    ) external onlyAgent tradingActive nonReentrant returns (bytes memory) {
        require(target != address(0), "TradingVault: zero target");
        _checkDailyReset();

        (bool success, bytes memory returnData) = target.call{value: amount}(data);

        executionLog.push(StrategyExecution({
            target: target,
            amount: amount,
            strategyName: strategyName,
            timestamp: block.timestamp,
            success: success,
            returnData: success ? returnData : bytes("")
        }));

        emit StrategyExecuted(target, amount, strategyName, success);

        if (!success) {
            // Record as loss event — strategy failed
            _updatePnl(-int256(amount / 100)); // Conservative: treat gas waste as small loss
        }

        require(success, "TradingVault: strategy execution failed");
        return returnData;
    }

    // ─── Position Management ───────────────────────────────────────────────────

    /**
     * @notice Open a tracked position
     */
    function openPosition(
        address token,
        uint256 size,
        uint256 entryPrice,
        bool isLong,
        string calldata strategy
    ) external onlyAgent returns (bytes32) {
        bytes32 positionId = keccak256(
            abi.encodePacked(token, size, entryPrice, block.timestamp, totalPositions)
        );

        openPositions[positionId] = Position({
            token: token,
            size: size,
            entryPrice: entryPrice,
            openedAt: block.timestamp,
            isLong: isLong,
            open: true,
            strategy: strategy
        });

        positionIds.push(positionId);
        totalPositions += 1;

        emit PositionOpened(positionId, token, size, entryPrice, isLong, strategy);
        return positionId;
    }

    /**
     * @notice Close a tracked position and record PnL
     */
    function closePosition(
        bytes32 positionId,
        uint256 exitPrice
    ) external onlyAgent {
        Position storage pos = openPositions[positionId];
        require(pos.open, "TradingVault: position not open");

        pos.open = false;

        // Calculate PnL
        int256 priceDiff = int256(exitPrice) - int256(pos.entryPrice);
        if (!pos.isLong) priceDiff = -priceDiff;
        int256 pnl = (priceDiff * int256(pos.size)) / int256(pos.entryPrice);

        _updatePnl(pnl);

        emit PositionClosed(positionId, exitPrice, pnl);
    }

    // ─── Daily Loss Limit ──────────────────────────────────────────────────────

    function _checkDailyReset() internal {
        if (block.timestamp >= dayStart + 1 days) {
            dayStart = block.timestamp;
            dailyPnl = 0;
            // Auto-resume trading on new day if it was halted by loss limit
            if (tradingHalted) {
                tradingHalted = false;
                emit TradingResumed(address(this));
            }
        }
    }

    function _updatePnl(int256 delta) internal {
        dailyPnl += delta;
        emit DailyPnlUpdated(dailyPnl);

        // Check loss limit
        uint256 totalValue = address(this).balance; // simplified — use MNT balance
        if (totalValue > 0) {
            uint256 lossThreshold = (totalValue * dailyLossLimitBps) / 10000;
            if (dailyPnl < 0 && uint256(-dailyPnl) >= lossThreshold) {
                tradingHalted = true;
                emit LossLimitHit(dailyPnl, lossThreshold);
            }
        }
    }

    function updatePnl(int256 delta) external onlyAgent {
        _checkDailyReset();
        _updatePnl(delta);
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function haltTrading() external onlyOwner {
        tradingHalted = true;
        emit TradingHalted(msg.sender);
    }

    function resumeTrading() external onlyOwner {
        tradingHalted = false;
        emit TradingResumed(msg.sender);
    }

    function setAgent(address newAgent) external onlyOwner {
        address old = agent;
        agent = newAgent;
        emit AgentUpdated(old, newAgent);
    }

    function setDailyLossLimit(uint256 bps) external onlyOwner {
        require(bps <= 2000, "TradingVault: loss limit too high");
        dailyLossLimitBps = bps;
    }

    function setStrategist(address strategist, bool authorized) external onlyOwner {
        authorizedStrategists[strategist] = authorized;
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getOpenPositions() external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < positionIds.length; i++) {
            if (openPositions[positionIds[i]].open) count++;
        }
        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < positionIds.length; i++) {
            if (openPositions[positionIds[i]].open) {
                result[idx++] = positionIds[i];
            }
        }
        return result;
    }

    function getPosition(bytes32 positionId) external view returns (Position memory) {
        return openPositions[positionId];
    }

    function getExecutionLogLength() external view returns (uint256) {
        return executionLog.length;
    }

    function getExecutionLog(uint256 index) external view returns (StrategyExecution memory) {
        require(index < executionLog.length, "TradingVault: index out of bounds");
        return executionLog[index];
    }

    function getVaultBalances() external view returns (uint256 mntBalance, uint256 methBalance) {
        mntBalance = address(this).balance;
        methBalance = IERC20(METH_TOKEN).balanceOf(address(this));
    }
}
