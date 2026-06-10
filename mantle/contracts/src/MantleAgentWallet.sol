// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAgentIdentity {
    function recordAction(uint256 tokenId, string calldata action, bytes32 txHash) external;
    function agentTokenId(address agent) external view returns (uint256);
}

/**
 * @title MantleAgentWallet
 * @notice AI agent wallet with spending limits, guardian, whitelist, and ERC-8004 identity on Mantle
 * @dev Supports MNT (native), mETH, and USDY token policies
 */
contract MantleAgentWallet is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Mantle Token Addresses ────────────────────────────────────────────────
    address public constant MNT_NATIVE = address(0); // Native MNT
    address public constant METH_TOKEN = 0xcDA86A272531e8640cD7F1a92c01839911B90bb0;
    address public constant USDY_TOKEN = 0x5bE26527e817998A7206475496fDE1E68957c5A9;

    // ─── Chain ─────────────────────────────────────────────────────────────────
    uint256 public constant CHAIN_ID = 5000;

    // ─── Identity ──────────────────────────────────────────────────────────────
    IAgentIdentity public identityContract;

    // ─── Roles ─────────────────────────────────────────────────────────────────
    address public agent;
    address public guardian;

    bool public paused;

    // ─── Spending Limits ───────────────────────────────────────────────────────
    struct SpendingPolicy {
        uint256 perTxLimit;    // max per single tx (in token units)
        uint256 dailyLimit;    // max per day
        uint256 dailySpent;    // spent today
        uint256 dayStart;      // timestamp of current day window
        bool enabled;
    }

    // token address => SpendingPolicy (address(0) = native MNT)
    mapping(address => SpendingPolicy) public tokenPolicies;

    // ─── Whitelist ─────────────────────────────────────────────────────────────
    mapping(address => bool) public whitelist;

    // ─── Timelock ──────────────────────────────────────────────────────────────
    uint256 public constant TIMELOCK_DELAY = 2 days;

    struct TimelockAction {
        bytes32 actionId;
        uint256 scheduledAt;
        bool executed;
        bool cancelled;
        bytes data;
    }

    mapping(bytes32 => TimelockAction) public timelockActions;

    // ─── Events ────────────────────────────────────────────────────────────────
    event Executed(address indexed target, uint256 value, bytes data, bytes returnData);
    event ExecutedWithIdentity(address indexed target, uint256 value, uint256 tokenId, string action);
    event TokenTransferred(address indexed token, address indexed to, uint256 amount);
    event SpendingPolicySet(address indexed token, uint256 perTxLimit, uint256 dailyLimit);
    event WhitelistUpdated(address indexed target, bool allowed);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event GuardianUpdated(address indexed oldGuardian, address indexed newGuardian);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event TimelockScheduled(bytes32 indexed actionId, uint256 executeAfter);
    event TimelockExecuted(bytes32 indexed actionId);
    event TimelockCancelled(bytes32 indexed actionId);
    event Deposited(address indexed token, uint256 amount);

    // ─── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyAgent() {
        require(msg.sender == agent, "MantleAgentWallet: caller is not agent");
        _;
    }

    modifier onlyAgentOrOwner() {
        require(
            msg.sender == agent || msg.sender == owner(),
            "MantleAgentWallet: caller is not agent or owner"
        );
        _;
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian, "MantleAgentWallet: caller is not guardian");
        _;
    }

    modifier notPaused() {
        require(!paused, "MantleAgentWallet: wallet is paused");
        _;
    }

    modifier onlyMantle() {
        require(block.chainid == CHAIN_ID, "MantleAgentWallet: wrong chain");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address _agent,
        address _guardian,
        address _identityContract
    ) Ownable(msg.sender) {
        require(_agent != address(0), "MantleAgentWallet: zero agent");
        require(_guardian != address(0), "MantleAgentWallet: zero guardian");

        agent = _agent;
        guardian = _guardian;
        identityContract = IAgentIdentity(_identityContract);

        // Default policies for Mantle tokens
        _setDefaultPolicies();
    }

    function _setDefaultPolicies() internal {
        // MNT: 1 MNT per tx, 10 MNT per day
        tokenPolicies[MNT_NATIVE] = SpendingPolicy({
            perTxLimit: 1 ether,
            dailyLimit: 10 ether,
            dailySpent: 0,
            dayStart: block.timestamp,
            enabled: true
        });

        // mETH: 0.01 mETH per tx, 0.1 mETH per day
        tokenPolicies[METH_TOKEN] = SpendingPolicy({
            perTxLimit: 0.01 ether,
            dailyLimit: 0.1 ether,
            dailySpent: 0,
            dayStart: block.timestamp,
            enabled: true
        });

        // USDY: 100 USDY per tx, 1000 USDY per day
        tokenPolicies[USDY_TOKEN] = SpendingPolicy({
            perTxLimit: 100e18,
            dailyLimit: 1000e18,
            dailySpent: 0,
            dayStart: block.timestamp,
            enabled: true
        });
    }

    // ─── Deposits ──────────────────────────────────────────────────────────────
    receive() external payable {
        emit Deposited(MNT_NATIVE, msg.value);
    }

    function depositToken(address token, uint256 amount) external {
        require(token != address(0), "MantleAgentWallet: use native deposit");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(token, amount);
    }

    // ─── Core Execution ────────────────────────────────────────────────────────

    /**
     * @notice Execute a transaction from the agent wallet
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyAgentOrOwner notPaused nonReentrant returns (bytes memory) {
        require(whitelist[target], "MantleAgentWallet: target not whitelisted");

        if (value > 0) {
            _checkAndUpdateSpending(MNT_NATIVE, value);
        }

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "MantleAgentWallet: execution failed");

        emit Executed(target, value, data, returnData);
        return returnData;
    }

    /**
     * @notice Execute a transaction and record the action in ERC-8004 identity
     * @param target Target contract address
     * @param value MNT value to send
     * @param data Calldata
     * @param actionDescription Human-readable description of what the agent is doing
     */
    function executeWithIdentity(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata actionDescription
    ) external onlyAgentOrOwner notPaused nonReentrant returns (bytes memory) {
        require(whitelist[target], "MantleAgentWallet: target not whitelisted");

        if (value > 0) {
            _checkAndUpdateSpending(MNT_NATIVE, value);
        }

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "MantleAgentWallet: execution failed");

        // Record in ERC-8004 identity
        uint256 tokenId = _getAgentTokenId();
        if (tokenId != 0 && address(identityContract) != address(0)) {
            bytes32 txHash = keccak256(abi.encodePacked(target, value, data, block.timestamp));
            try identityContract.recordAction(tokenId, actionDescription, txHash) {} catch {}
        }

        emit ExecutedWithIdentity(target, value, tokenId, actionDescription);
        return returnData;
    }

    /**
     * @notice Transfer native MNT
     */
    function transferMNT(
        address payable to,
        uint256 amount
    ) external onlyAgentOrOwner notPaused nonReentrant {
        require(whitelist[to], "MantleAgentWallet: recipient not whitelisted");
        require(address(this).balance >= amount, "MantleAgentWallet: insufficient MNT");
        _checkAndUpdateSpending(MNT_NATIVE, amount);

        (bool success,) = to.call{value: amount}("");
        require(success, "MantleAgentWallet: MNT transfer failed");

        emit TokenTransferred(MNT_NATIVE, to, amount);
    }

    /**
     * @notice Transfer ERC20 token (mETH, USDY, or any whitelisted token)
     */
    function transferToken(
        address token,
        address to,
        uint256 amount
    ) external onlyAgentOrOwner notPaused nonReentrant {
        require(token != address(0), "MantleAgentWallet: use transferMNT for native");
        require(whitelist[to], "MantleAgentWallet: recipient not whitelisted");
        _checkAndUpdateSpending(token, amount);

        IERC20(token).safeTransfer(to, amount);
        emit TokenTransferred(token, to, amount);
    }

    // ─── Spending Policy ───────────────────────────────────────────────────────

    function _checkAndUpdateSpending(address token, uint256 amount) internal {
        SpendingPolicy storage policy = tokenPolicies[token];
        if (!policy.enabled) return;

        // Reset daily window if needed
        if (block.timestamp >= policy.dayStart + 1 days) {
            policy.dayStart = block.timestamp;
            policy.dailySpent = 0;
        }

        require(amount <= policy.perTxLimit, "MantleAgentWallet: exceeds per-tx limit");
        require(
            policy.dailySpent + amount <= policy.dailyLimit,
            "MantleAgentWallet: exceeds daily limit"
        );

        policy.dailySpent += amount;
    }

    function setSpendingPolicy(
        address token,
        uint256 perTxLimit,
        uint256 dailyLimit
    ) external onlyOwner {
        tokenPolicies[token].perTxLimit = perTxLimit;
        tokenPolicies[token].dailyLimit = dailyLimit;
        tokenPolicies[token].enabled = true;
        emit SpendingPolicySet(token, perTxLimit, dailyLimit);
    }

    function getDailyRemaining(address token) external view returns (uint256) {
        SpendingPolicy storage policy = tokenPolicies[token];
        if (!policy.enabled) return type(uint256).max;
        if (block.timestamp >= policy.dayStart + 1 days) return policy.dailyLimit;
        if (policy.dailySpent >= policy.dailyLimit) return 0;
        return policy.dailyLimit - policy.dailySpent;
    }

    // ─── Whitelist ─────────────────────────────────────────────────────────────

    function setWhitelist(address target, bool allowed) external onlyOwner {
        whitelist[target] = allowed;
        emit WhitelistUpdated(target, allowed);
    }

    function batchSetWhitelist(address[] calldata targets, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            whitelist[targets[i]] = allowed;
            emit WhitelistUpdated(targets[i], allowed);
        }
    }

    // ─── Guardian Controls ─────────────────────────────────────────────────────

    function pause() external onlyGuardian {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyGuardian {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyGuardian {
        require(to != address(0), "MantleAgentWallet: zero address");
        if (token == MNT_NATIVE) {
            (bool success,) = payable(to).call{value: amount}("");
            require(success, "MantleAgentWallet: MNT withdraw failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    // ─── Timelock ──────────────────────────────────────────────────────────────

    function scheduleTimelockAction(bytes calldata data) external onlyOwner returns (bytes32) {
        bytes32 actionId = keccak256(abi.encodePacked(data, block.timestamp, msg.sender));
        timelockActions[actionId] = TimelockAction({
            actionId: actionId,
            scheduledAt: block.timestamp,
            executed: false,
            cancelled: false,
            data: data
        });
        emit TimelockScheduled(actionId, block.timestamp + TIMELOCK_DELAY);
        return actionId;
    }

    function executeTimelockAction(bytes32 actionId) external onlyOwner {
        TimelockAction storage action = timelockActions[actionId];
        require(action.scheduledAt > 0, "MantleAgentWallet: action not found");
        require(!action.executed, "MantleAgentWallet: already executed");
        require(!action.cancelled, "MantleAgentWallet: cancelled");
        require(
            block.timestamp >= action.scheduledAt + TIMELOCK_DELAY,
            "MantleAgentWallet: timelock not elapsed"
        );

        action.executed = true;
        (bool success,) = address(this).call(action.data);
        require(success, "MantleAgentWallet: timelock action failed");
        emit TimelockExecuted(actionId);
    }

    function cancelTimelockAction(bytes32 actionId) external onlyOwner {
        TimelockAction storage action = timelockActions[actionId];
        require(action.scheduledAt > 0, "MantleAgentWallet: action not found");
        require(!action.executed, "MantleAgentWallet: already executed");
        action.cancelled = true;
        emit TimelockCancelled(actionId);
    }

    // ─── Role Management ───────────────────────────────────────────────────────

    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "MantleAgentWallet: zero address");
        address old = agent;
        agent = newAgent;
        emit AgentUpdated(old, newAgent);
    }

    function setGuardian(address newGuardian) external onlyOwner {
        require(newGuardian != address(0), "MantleAgentWallet: zero address");
        address old = guardian;
        guardian = newGuardian;
        emit GuardianUpdated(old, newGuardian);
    }

    function setIdentityContract(address _identityContract) external onlyOwner {
        identityContract = IAgentIdentity(_identityContract);
    }

    // ─── View Helpers ──────────────────────────────────────────────────────────

    function _getAgentTokenId() internal view returns (uint256) {
        if (address(identityContract) == address(0)) return 0;
        try identityContract.agentTokenId(agent) returns (uint256 tokenId) {
            return tokenId;
        } catch {
            return 0;
        }
    }

    function getBalance(address token) external view returns (uint256) {
        if (token == MNT_NATIVE) return address(this).balance;
        return IERC20(token).balanceOf(address(this));
    }

    function getAgentTokenId() external view returns (uint256) {
        return _getAgentTokenId();
    }
}
