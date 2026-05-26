// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract AgentWallet is ReentrancyGuard {
  // ── Roles ──────────────────────────────────────────────────────────────
  address public agent;
  address public pendingAgent;
  address public guardian;
  address public pendingGuardian;

  modifier onlyAgent() {
    require(msg.sender == agent, 'Not agent');
    _;
  }
  modifier onlyGuardian() {
    require(msg.sender == guardian, 'Not guardian');
    _;
  }
  modifier notPaused() {
    require(!paused, 'Paused');
    _;
  }

  // ── State ──────────────────────────────────────────────────────────────
  bool public paused;

  uint256 public ethTxLimit;
  uint256 public ethDailyLimit;
  uint256 public ethDailySpent;
  uint256 public ethLastReset;

  // ── Token policy ───────────────────────────────────────────────────────
  struct TokenPolicy {
    uint256 dailyLimit;
    uint256 dailySpent;
    uint256 lastReset;
    bool enabled;
  }
  mapping(address => TokenPolicy) public tokenPolicy;

  // ── Call policy ────────────────────────────────────────────────────────
  struct CallPolicy {
    bool allowed;
    bool checkRecipient;
    bool checkAmount;
    uint256 maxAmount;
    mapping(address => bool) allowedRecipients;
  }
  mapping(address => mapping(bytes4 => CallPolicy)) private _callPolicy;

  // ── Timelocked queues ──────────────────────────────────────────────────
  uint256 public constant TIMELOCK = 10 minutes;

  struct PendingLimitChange {
    uint256 txLimit;
    uint256 dailyLimit;
    uint256 unlockTime;
    bool queued;
  }
  PendingLimitChange public pendingLimitChange;

  struct PendingCall {
    address target;
    bytes4 selector;
    bool checkRecipient;
    bool checkAmount;
    uint256 maxAmount;
    uint256 unlockTime;
    bool queued;
  }
  PendingCall public pendingCall;

  // ── Events ─────────────────────────────────────────────────────────────
  event Executed(address indexed target, uint256 value, bytes4 selector);
  event Withdrawn(address indexed to, uint256 amount);
  event Paused(address indexed by);
  event Unpaused(address indexed by);
  event AgentTransferStarted(address indexed newAgent);
  event AgentTransferred(address indexed previousAgent, address indexed newAgent);
  event GuardianTransferred(address indexed previousGuardian, address indexed newGuardian);
  event CallQueued(address indexed target, bytes4 selector, uint256 unlockTime);
  event CallApplied(address indexed target, bytes4 selector);
  event CallQueueCancelled(address indexed target, bytes4 selector);
  event CallRemoved(address indexed target, bytes4 selector);
  event RecipientAdded(address indexed target, bytes4 selector, address indexed recipient);
  event RecipientRemoved(address indexed target, bytes4 selector, address indexed recipient);
  event LimitChangeQueued(uint256 txLimit, uint256 daily, uint256 unlockTime);
  event LimitChangeApplied(uint256 txLimit, uint256 daily);
  event LimitChangeCancelled();
  event LimitsDecreased(uint256 txLimit, uint256 daily);
  event TokenPolicySet(address indexed token, uint256 dailyLimit);
  event TokenPolicyRevoked(address indexed token);

  // ── Constructor ────────────────────────────────────────────────────────
  constructor(address _agent, address _guardian, uint256 _ethTxLimit, uint256 _ethDailyLimit) {
    require(_agent != address(0), 'Zero agent');
    require(_guardian != address(0), 'Zero guardian');
    require(_ethTxLimit > 0 && _ethDailyLimit >= _ethTxLimit, 'Bad limits');
    agent = _agent;
    guardian = _guardian;
    ethTxLimit = _ethTxLimit;
    ethDailyLimit = _ethDailyLimit;
    ethLastReset = block.timestamp;
  }

  // ── Execute (agent only) ───────────────────────────────────────────────
  function execute(
    address target,
    uint256 value,
    bytes calldata data
  ) external notPaused onlyAgent nonReentrant returns (bytes memory) {
    require(target != address(0), 'Zero target');

    // bytes4(0) is reserved for a true bare ETH transfer only.
    require(data.length == 0 || data.length >= 4, 'Invalid calldata');
    bytes4 sel = data.length == 0 ? bytes4(0) : bytes4(data[0:4]);

    CallPolicy storage cp = _callPolicy[target][sel];
    require(cp.allowed, 'Call not whitelisted');

    (
      address policyRecipient,
      uint256 policyAmount,
      bool hasRecipient,
      bool hasAmount
    ) = _extractPolicyFields(sel, data);

    if (cp.checkRecipient) {
      require(hasRecipient, 'Recipient missing');
      require(cp.allowedRecipients[policyRecipient], 'Recipient not allowed');
    }
    if (cp.checkAmount) {
      require(hasAmount, 'Amount missing');
      require(policyAmount <= cp.maxAmount, 'Amount exceeds policy');
    }

    if (value > 0) {
      require(value <= ethTxLimit, 'Exceeds ETH tx limit');
      _updateEthDaily(value);
    }

    if (data.length >= 4) {
      _enforceTokenPolicy(target, sel, data);
    }

    (bool ok, bytes memory res) = target.call{value: value}(data);
    require(ok, 'Execution failed');

    emit Executed(target, value, sel);
    return res;
  }

  function _enforceTokenPolicy(address token, bytes4 sel, bytes calldata data) internal {
    TokenPolicy storage tp = tokenPolicy[token];
    if (!tp.enabled) return;
    if (
      sel != IERC20.transfer.selector &&
      sel != IERC20.approve.selector &&
      sel != IERC20.transferFrom.selector
    ) {
      return;
    }

    (, uint256 amount, , bool hasAmount) = _extractPolicyFields(sel, data);
    if (!hasAmount) return;

    if (block.timestamp >= tp.lastReset + 1 days) {
      tp.dailySpent = 0;
      tp.lastReset = block.timestamp;
    }
    require(tp.dailySpent + amount <= tp.dailyLimit, 'Token daily limit exceeded');
    tp.dailySpent += amount;
  }

  function _extractPolicyFields(
    bytes4 sel,
    bytes calldata data
  ) internal pure returns (address recipient, uint256 amount, bool hasRecipient, bool hasAmount) {
    if (sel == IERC20.transferFrom.selector) {
      if (data.length >= 68) {
        recipient = address(uint160(uint256(bytes32(data[36:68]))));
        hasRecipient = true;
      }
      if (data.length >= 100) {
        amount = uint256(bytes32(data[68:100]));
        hasAmount = true;
      }
    } else {
      if (data.length >= 36) {
        recipient = address(uint160(uint256(bytes32(data[4:36]))));
        hasRecipient = true;
      }
      if (data.length >= 68) {
        amount = uint256(bytes32(data[36:68]));
        hasAmount = true;
      }
    }
  }

  // ── Withdrawal (guardian only, respects pause) ─────────────────────────
  function withdraw(address to, uint256 amount) external onlyGuardian notPaused nonReentrant {
    require(to != address(0), 'Zero address');
    require(amount <= address(this).balance, 'Insufficient balance');
    (bool ok, ) = to.call{value: amount}('');
    require(ok, 'Withdraw failed');
    emit Withdrawn(to, amount);
  }

  // ── Pause ──────────────────────────────────────────────────────────────
  function pause() external onlyGuardian {
    paused = true;
    emit Paused(msg.sender);
  }

  function unpause() external onlyGuardian {
    paused = false;
    emit Unpaused(msg.sender);
  }

  // ── Whitelist queue ────────────────────────────────────────────────────
  function queueCall(
    address target,
    bytes4 selector,
    bool checkRecipient,
    bool checkAmount,
    uint256 maxAmount
  ) external onlyGuardian {
    require(target != address(0), 'Zero target');
    require(!pendingCall.queued, 'Already queued');
    uint256 unlock = block.timestamp + TIMELOCK;
    pendingCall = PendingCall(
      target,
      selector,
      checkRecipient,
      checkAmount,
      maxAmount,
      unlock,
      true
    );
    emit CallQueued(target, selector, unlock);
  }

  function applyCall() external onlyGuardian {
    require(pendingCall.queued, 'Nothing queued');
    require(block.timestamp >= pendingCall.unlockTime, 'Timelock active');
    PendingCall memory pc = pendingCall;
    CallPolicy storage cp = _callPolicy[pc.target][pc.selector];
    cp.allowed = true;
    cp.checkRecipient = pc.checkRecipient;
    cp.checkAmount = pc.checkAmount;
    cp.maxAmount = pc.maxAmount;
    delete pendingCall;
    emit CallApplied(pc.target, pc.selector);
  }

  function cancelCallQueue() external onlyGuardian {
    require(pendingCall.queued, 'Nothing to cancel');
    emit CallQueueCancelled(pendingCall.target, pendingCall.selector);
    delete pendingCall;
  }

  function removeCall(address target, bytes4 selector) external onlyGuardian {
    _callPolicy[target][selector].allowed = false;
    emit CallRemoved(target, selector);
  }

  // ── Recipient management ───────────────────────────────────────────────
  function addRecipient(address target, bytes4 sel, address recipient) external onlyGuardian {
    require(recipient != address(0), 'Zero recipient');
    _callPolicy[target][sel].allowedRecipients[recipient] = true;
    emit RecipientAdded(target, sel, recipient);
  }

  function removeRecipient(address target, bytes4 sel, address recipient) external onlyGuardian {
    _callPolicy[target][sel].allowedRecipients[recipient] = false;
    emit RecipientRemoved(target, sel, recipient);
  }

  function isRecipientAllowed(
    address target,
    bytes4 sel,
    address recipient
  ) external view returns (bool) {
    return _callPolicy[target][sel].allowedRecipients[recipient];
  }

  // ── Token policy ───────────────────────────────────────────────────────
  function setTokenPolicy(address token, uint256 _dailyLimit) external onlyGuardian {
    require(token != address(0), 'Zero token');
    require(_dailyLimit > 0, 'Zero limit');
    TokenPolicy storage tp = tokenPolicy[token];
    tp.dailyLimit = _dailyLimit;
    tp.dailySpent = 0;
    tp.lastReset = block.timestamp;
    tp.enabled = true;
    emit TokenPolicySet(token, _dailyLimit);
  }

  function revokeTokenPolicy(address token) external onlyGuardian {
    tokenPolicy[token].enabled = false;
    emit TokenPolicyRevoked(token);
  }

  // ── ETH limit changes ──────────────────────────────────────────────────
  function queueLimitChange(uint256 _txLimit, uint256 _dailyLimit) external onlyGuardian {
    require(_txLimit > 0 && _dailyLimit >= _txLimit, 'Bad limits');
    require(!pendingLimitChange.queued, 'Already queued');
    uint256 unlock = block.timestamp + TIMELOCK;
    pendingLimitChange = PendingLimitChange(_txLimit, _dailyLimit, unlock, true);
    emit LimitChangeQueued(_txLimit, _dailyLimit, unlock);
  }

  function applyLimitChange() external onlyGuardian {
    require(pendingLimitChange.queued, 'Nothing queued');
    require(block.timestamp >= pendingLimitChange.unlockTime, 'Timelock active');
    ethTxLimit = pendingLimitChange.txLimit;
    ethDailyLimit = pendingLimitChange.dailyLimit;
    delete pendingLimitChange;
    emit LimitChangeApplied(ethTxLimit, ethDailyLimit);
  }

  function cancelLimitChange() external onlyGuardian {
    require(pendingLimitChange.queued, 'Nothing to cancel');
    delete pendingLimitChange;
    emit LimitChangeCancelled();
  }

  function decreaseLimits(uint256 _txLimit, uint256 _dailyLimit) external onlyGuardian {
    require(_txLimit > 0 && _dailyLimit >= _txLimit, 'Bad limits');
    require(
      _txLimit <= ethTxLimit && _dailyLimit <= ethDailyLimit,
      'Use queueLimitChange to raise limits'
    );
    if (pendingLimitChange.queued) {
      delete pendingLimitChange;
      emit LimitChangeCancelled();
    }
    ethTxLimit = _txLimit;
    ethDailyLimit = _dailyLimit;
    emit LimitsDecreased(_txLimit, _dailyLimit);
  }

  // ── Role transfers (2-step) ────────────────────────────────────────────
  function transferAgent(address newAgent) external onlyGuardian {
    require(newAgent != address(0), 'Zero address');
    pendingAgent = newAgent;
    emit AgentTransferStarted(newAgent);
  }

  function acceptAgent() external {
    require(msg.sender == pendingAgent, 'Not pending agent');
    emit AgentTransferred(agent, pendingAgent);
    agent = pendingAgent;
    pendingAgent = address(0);
  }

  function transferGuardian(address newGuardian) external onlyGuardian {
    require(newGuardian != address(0), 'Zero address');
    pendingGuardian = newGuardian;
  }

  function acceptGuardian() external {
    require(msg.sender == pendingGuardian, 'Not pending guardian');
    emit GuardianTransferred(guardian, pendingGuardian);
    guardian = pendingGuardian;
    pendingGuardian = address(0);
  }

  // ── Internal ───────────────────────────────────────────────────────────
  function _updateEthDaily(uint256 value) internal {
    if (block.timestamp >= ethLastReset + 1 days) {
      ethDailySpent = 0;
      ethLastReset = block.timestamp;
    }
    require(ethDailySpent + value <= ethDailyLimit, 'ETH daily limit exceeded');
    ethDailySpent += value;
  }

  receive() external payable {}
}
