// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AgentWallet.sol";

contract CallTarget {
    uint256 public receiveCount;
    uint256 public fallbackCount;
    uint256 public pingCount;
    uint256 public pingNoArgsCount;
    uint256 public totalValueReceived;
    address public lastRecipient;
    uint256 public lastAmount;
    bytes public lastFallbackData;

    receive() external payable {
        receiveCount++;
        totalValueReceived += msg.value;
    }

    fallback() external payable {
        fallbackCount++;
        totalValueReceived += msg.value;
        lastFallbackData = msg.data;
    }

    function ping(address recipient, uint256 amount) external payable returns (bytes32) {
        pingCount++;
        totalValueReceived += msg.value;
        lastRecipient = recipient;
        lastAmount = amount;
        return keccak256("pong");
    }

    function pingNoArgs() external returns (uint256) {
        pingNoArgsCount++;
        return 42;
    }

    function willRevert() external pure {
        revert("target reverted");
    }
}

contract MockERC20 {
    string public constant name = "Mock Token";
    string public constant symbol = "MOCK";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "allowance");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero to");
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract ReenterExecuteTarget {
    AgentWallet public wallet;
    address public nestedTarget;
    bytes public nestedData;
    bool public reenterAttempted;
    bool public reenterSucceeded;
    bool public reenterFailed;

    receive() external payable {
        _tryReenter();
    }

    fallback() external payable {
        _tryReenter();
    }

    function setWallet(AgentWallet newWallet) external {
        wallet = newWallet;
    }

    function setNestedCall(address target, bytes calldata data) external {
        nestedTarget = target;
        nestedData = data;
    }

    function _tryReenter() internal {
        if (reenterAttempted) return;
        reenterAttempted = true;

        try wallet.execute(nestedTarget, 0, nestedData) returns (bytes memory) {
            reenterSucceeded = true;
        } catch {
            reenterFailed = true;
        }
    }
}

contract ReenterWithdrawReceiver {
    AgentWallet public wallet;
    bool public attackEnabled;
    uint256 public receiveCount;
    bool public reenterSucceeded;
    bool public reenterFailed;

    receive() external payable {
        receiveCount++;
        if (!attackEnabled || receiveCount > 1) return;

        try wallet.withdraw(address(this), 0.1 ether) {
            reenterSucceeded = true;
        } catch {
            reenterFailed = true;
        }
    }

    function setWallet(AgentWallet newWallet) external {
        wallet = newWallet;
    }

    function setAttackEnabled(bool enabled) external {
        attackEnabled = enabled;
    }
}

contract AgentWalletTest is Test {
    AgentWallet internal wallet;
    CallTarget internal target;
    MockERC20 internal token;

    address internal agent = address(0xA11CE);
    address internal guardian = address(0xB0B);
    address internal attacker = address(0xBAD);
    address internal recipient = address(0xCAFE);
    address internal otherRecipient = address(0xF00D);

    uint256 internal constant ETH_TX_LIMIT = 0.1 ether;
    uint256 internal constant ETH_DAILY_LIMIT = 0.5 ether;
    uint256 internal constant TOKEN_DAILY_LIMIT = 500 ether;
    uint256 internal constant TOKEN_MAX_PER_CALL = 300 ether;

    event Executed(address indexed target, uint256 value, bytes4 selector);
    event Withdrawn(address indexed to, uint256 amount);

    function setUp() public {
        target = new CallTarget();
        token = new MockERC20();
        wallet = new AgentWallet(agent, guardian, ETH_TX_LIMIT, ETH_DAILY_LIMIT);

        vm.deal(address(wallet), 10 ether);
        token.mint(address(wallet), 1_000 ether);
    }

    // ---------------------------------------------------------------------
    // Constructor and roles
    // ---------------------------------------------------------------------

    function testConstructorStoresInitialState() public view {
        assertEq(wallet.agent(), agent);
        assertEq(wallet.guardian(), guardian);
        assertEq(wallet.ethTxLimit(), ETH_TX_LIMIT);
        assertEq(wallet.ethDailyLimit(), ETH_DAILY_LIMIT);
        assertEq(wallet.ethDailySpent(), 0);
        assertFalse(wallet.paused());
        assertEq(address(wallet).balance, 10 ether);
    }

    function testConstructorRejectsBadInputs() public {
        vm.expectRevert("Zero agent");
        new AgentWallet(address(0), guardian, ETH_TX_LIMIT, ETH_DAILY_LIMIT);

        vm.expectRevert("Zero guardian");
        new AgentWallet(agent, address(0), ETH_TX_LIMIT, ETH_DAILY_LIMIT);

        vm.expectRevert("Bad limits");
        new AgentWallet(agent, guardian, 0, ETH_DAILY_LIMIT);

        vm.expectRevert("Bad limits");
        new AgentWallet(agent, guardian, ETH_DAILY_LIMIT + 1, ETH_DAILY_LIMIT);
    }

    function testOnlyAgentCanExecute() public {
        vm.prank(guardian);
        vm.expectRevert("Not agent");
        wallet.execute(address(target), 0, "");

        vm.prank(attacker);
        vm.expectRevert("Not agent");
        wallet.execute(address(target), 0, "");
    }

    function testOnlyGuardianCanUseAdminFunctions() public {
        vm.startPrank(attacker);

        vm.expectRevert("Not guardian");
        wallet.pause();

        vm.expectRevert("Not guardian");
        wallet.unpause();

        vm.expectRevert("Not guardian");
        wallet.withdraw(attacker, 1 wei);

        vm.expectRevert("Not guardian");
        wallet.queueCall(address(target), bytes4(0), false, false, 0);

        vm.expectRevert("Not guardian");
        wallet.applyCall();

        vm.expectRevert("Not guardian");
        wallet.cancelCallQueue();

        vm.expectRevert("Not guardian");
        wallet.removeCall(address(target), bytes4(0));

        vm.expectRevert("Not guardian");
        wallet.addRecipient(address(target), CallTarget.ping.selector, recipient);

        vm.expectRevert("Not guardian");
        wallet.removeRecipient(address(target), CallTarget.ping.selector, recipient);

        vm.expectRevert("Not guardian");
        wallet.setTokenPolicy(address(token), TOKEN_DAILY_LIMIT);

        vm.expectRevert("Not guardian");
        wallet.revokeTokenPolicy(address(token));

        vm.expectRevert("Not guardian");
        wallet.queueLimitChange(ETH_TX_LIMIT, ETH_DAILY_LIMIT);

        vm.expectRevert("Not guardian");
        wallet.applyLimitChange();

        vm.expectRevert("Not guardian");
        wallet.cancelLimitChange();

        vm.expectRevert("Not guardian");
        wallet.decreaseLimits(ETH_TX_LIMIT, ETH_DAILY_LIMIT);

        vm.expectRevert("Not guardian");
        wallet.transferAgent(attacker);

        vm.expectRevert("Not guardian");
        wallet.transferGuardian(attacker);

        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // Pause and withdrawal
    // ---------------------------------------------------------------------

    function testGuardianCanPauseAndUnpause() public {
        vm.prank(guardian);
        wallet.pause();
        assertTrue(wallet.paused());

        vm.prank(guardian);
        wallet.unpause();
        assertFalse(wallet.paused());
    }

    function testPauseBlocksExecuteAndWithdraw() public {
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        vm.prank(guardian);
        wallet.pause();

        vm.prank(agent);
        vm.expectRevert("Paused");
        wallet.execute(address(target), 0, "");

        vm.prank(guardian);
        vm.expectRevert("Paused");
        wallet.withdraw(guardian, 0.1 ether);
    }

    function testGuardianWithdrawsEth() public {
        uint256 guardianBefore = guardian.balance;

        vm.prank(guardian);
        vm.expectEmit(true, false, false, true, address(wallet));
        emit Withdrawn(guardian, 0.25 ether);
        wallet.withdraw(guardian, 0.25 ether);

        assertEq(guardian.balance, guardianBefore + 0.25 ether);
        assertEq(address(wallet).balance, 9.75 ether);
    }

    function testWithdrawRejectsBadInputs() public {
        vm.prank(guardian);
        vm.expectRevert("Zero address");
        wallet.withdraw(address(0), 1 wei);

        vm.prank(guardian);
        vm.expectRevert("Insufficient balance");
        wallet.withdraw(guardian, 11 ether);
    }

    // ---------------------------------------------------------------------
    // Call queue, whitelist and execution behavior
    // ---------------------------------------------------------------------

    function testQueueCallRequiresValidTargetAndNoExistingQueue() public {
        vm.prank(guardian);
        vm.expectRevert("Zero target");
        wallet.queueCall(address(0), bytes4(0), false, false, 0);

        vm.prank(guardian);
        wallet.queueCall(address(target), bytes4(0), false, false, 0);

        vm.prank(guardian);
        vm.expectRevert("Already queued");
        wallet.queueCall(address(target), CallTarget.ping.selector, false, false, 0);
    }

    function testCannotApplyCallBeforeTimelock() public {
        vm.prank(guardian);
        wallet.queueCall(address(target), bytes4(0), false, false, 0);

        vm.prank(guardian);
        vm.expectRevert("Timelock active");
        wallet.applyCall();
    }

    function testCancelCallQueueClearsPendingCall() public {
        vm.prank(guardian);
        wallet.queueCall(address(target), bytes4(0), false, false, 0);

        vm.prank(guardian);
        wallet.cancelCallQueue();

        vm.prank(guardian);
        vm.expectRevert("Nothing queued");
        wallet.applyCall();

        vm.prank(guardian);
        wallet.queueCall(address(target), CallTarget.ping.selector, false, false, 0);
    }

    function testWhitelistedBareEthTransferExecutes() public {
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        vm.prank(agent);
        vm.expectEmit(true, false, false, true, address(wallet));
        emit Executed(address(target), 0.1 ether, bytes4(0));
        wallet.execute(address(target), 0.1 ether, "");

        assertEq(target.receiveCount(), 1);
        assertEq(target.totalValueReceived(), 0.1 ether);
        assertEq(wallet.ethDailySpent(), 0.1 ether);
    }

    function testExecuteRejectsUnwhitelistedCall() public {
        vm.prank(agent);
        vm.expectRevert("Call not whitelisted");
        wallet.execute(address(target), 0, "");
    }

    function testExecuteRejectsZeroTarget() public {
        vm.prank(agent);
        vm.expectRevert("Zero target");
        wallet.execute(address(0), 0, "");
    }

    function testExecuteRejectsShortMalformedCalldata() public {
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        vm.prank(agent);
        vm.expectRevert("Invalid calldata");
        wallet.execute(address(target), 0, hex"01");
    }

    function testWhitelistIsExactByTargetAndSelector() public {
        CallTarget secondTarget = new CallTarget();
        _queueAndApplyCall(address(target), CallTarget.ping.selector, false, false, 0);

        bytes memory pingData = abi.encodeWithSelector(CallTarget.ping.selector, recipient, 123);
        bytes memory returnData;

        vm.prank(agent);
        returnData = wallet.execute(address(target), 0, pingData);
        assertEq(abi.decode(returnData, (bytes32)), keccak256("pong"));
        assertEq(target.pingCount(), 1);

        vm.prank(agent);
        vm.expectRevert("Call not whitelisted");
        wallet.execute(address(target), 0, abi.encodeWithSelector(CallTarget.pingNoArgs.selector));

        vm.prank(agent);
        vm.expectRevert("Call not whitelisted");
        wallet.execute(address(secondTarget), 0, pingData);
    }

    function testRemoveCallDisablesPreviouslyAllowedCall() public {
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        vm.prank(agent);
        wallet.execute(address(target), 0, "");
        assertEq(target.receiveCount(), 1);

        vm.prank(guardian);
        wallet.removeCall(address(target), bytes4(0));

        vm.prank(agent);
        vm.expectRevert("Call not whitelisted");
        wallet.execute(address(target), 0, "");
    }

    function testExternalCallRevertDoesNotConsumeDailyLimit() public {
        _queueAndApplyCall(address(target), CallTarget.willRevert.selector, false, false, 0);

        vm.prank(agent);
        vm.expectRevert("Execution failed");
        wallet.execute(address(target), 0.1 ether, abi.encodeWithSelector(CallTarget.willRevert.selector));

        assertEq(wallet.ethDailySpent(), 0);
    }

    // ---------------------------------------------------------------------
    // ETH spending limits
    // ---------------------------------------------------------------------

    function testEthPerTransactionLimitIsEnforced() public {
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        vm.prank(agent);
        vm.expectRevert("Exceeds ETH tx limit");
        wallet.execute(address(target), ETH_TX_LIMIT + 1, "");
    }

    function testEthDailyLimitIsEnforced() public {
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            wallet.execute(address(target), 0.1 ether, "");
        }

        assertEq(wallet.ethDailySpent(), ETH_DAILY_LIMIT);

        vm.prank(agent);
        vm.expectRevert("ETH daily limit exceeded");
        wallet.execute(address(target), 1 wei, "");
    }

    function testEthDailyLimitResetsAfterOneDay() public {
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agent);
            wallet.execute(address(target), 0.1 ether, "");
        }
        assertEq(wallet.ethDailySpent(), ETH_DAILY_LIMIT);

        vm.warp(block.timestamp + 1 days);

        vm.prank(agent);
        wallet.execute(address(target), 0.1 ether, "");

        assertEq(wallet.ethDailySpent(), 0.1 ether);
    }

    function testZeroValueExecutionDoesNotConsumeEthDailyLimit() public {
        _queueAndApplyCall(address(target), CallTarget.pingNoArgs.selector, false, false, 0);

        vm.prank(agent);
        wallet.execute(address(target), 0, abi.encodeWithSelector(CallTarget.pingNoArgs.selector));

        assertEq(wallet.ethDailySpent(), 0);
        assertEq(target.pingNoArgsCount(), 1);
    }

    // ---------------------------------------------------------------------
    // Recipient and amount call policies
    // ---------------------------------------------------------------------

    function testRecipientAndAmountPolicyAllowsValidCall() public {
        _queueAndApplyCall(address(target), CallTarget.ping.selector, true, true, 100);

        vm.prank(guardian);
        wallet.addRecipient(address(target), CallTarget.ping.selector, recipient);

        vm.prank(agent);
        wallet.execute(address(target), 0, abi.encodeWithSelector(CallTarget.ping.selector, recipient, 100));

        assertEq(target.pingCount(), 1);
        assertEq(target.lastRecipient(), recipient);
        assertEq(target.lastAmount(), 100);
    }

    function testRecipientPolicyRejectsDisallowedRecipient() public {
        _queueAndApplyCall(address(target), CallTarget.ping.selector, true, true, 100);

        vm.prank(guardian);
        wallet.addRecipient(address(target), CallTarget.ping.selector, recipient);

        vm.prank(agent);
        vm.expectRevert("Recipient not allowed");
        wallet.execute(address(target), 0, abi.encodeWithSelector(CallTarget.ping.selector, otherRecipient, 50));
    }

    function testRecipientPolicyRejectsMissingRecipientArgument() public {
        _queueAndApplyCall(address(target), CallTarget.ping.selector, true, false, 0);

        vm.prank(agent);
        vm.expectRevert("Recipient missing");
        wallet.execute(address(target), 0, abi.encodePacked(CallTarget.ping.selector));
    }

    function testAmountPolicyRejectsOverLimitAmount() public {
        _queueAndApplyCall(address(target), CallTarget.ping.selector, true, true, 100);

        vm.prank(guardian);
        wallet.addRecipient(address(target), CallTarget.ping.selector, recipient);

        vm.prank(agent);
        vm.expectRevert("Amount exceeds policy");
        wallet.execute(address(target), 0, abi.encodeWithSelector(CallTarget.ping.selector, recipient, 101));
    }

    function testAmountPolicyRejectsMissingAmountArgument() public {
        _queueAndApplyCall(address(target), CallTarget.ping.selector, false, true, 100);

        vm.prank(agent);
        vm.expectRevert("Amount missing");
        wallet.execute(address(target), 0, abi.encodePacked(CallTarget.ping.selector, recipient));
    }

    function testRemoveRecipientBlocksFutureCalls() public {
        _queueAndApplyCall(address(target), CallTarget.ping.selector, true, true, 100);

        vm.startPrank(guardian);
        wallet.addRecipient(address(target), CallTarget.ping.selector, recipient);
        assertTrue(wallet.isRecipientAllowed(address(target), CallTarget.ping.selector, recipient));
        wallet.removeRecipient(address(target), CallTarget.ping.selector, recipient);
        assertFalse(wallet.isRecipientAllowed(address(target), CallTarget.ping.selector, recipient));
        vm.stopPrank();

        vm.prank(agent);
        vm.expectRevert("Recipient not allowed");
        wallet.execute(address(target), 0, abi.encodeWithSelector(CallTarget.ping.selector, recipient, 50));
    }

    // ---------------------------------------------------------------------
    // ERC20 token policy
    // ---------------------------------------------------------------------

    function testSetAndRevokeTokenPolicy() public {
        vm.prank(guardian);
        wallet.setTokenPolicy(address(token), TOKEN_DAILY_LIMIT);

        (uint256 dailyLimit, uint256 dailySpent,, bool enabled) = wallet.tokenPolicy(address(token));
        assertEq(dailyLimit, TOKEN_DAILY_LIMIT);
        assertEq(dailySpent, 0);
        assertTrue(enabled);

        vm.prank(guardian);
        wallet.revokeTokenPolicy(address(token));

        (,,, enabled) = wallet.tokenPolicy(address(token));
        assertFalse(enabled);
    }

    function testSetTokenPolicyRejectsBadInputs() public {
        vm.prank(guardian);
        vm.expectRevert("Zero token");
        wallet.setTokenPolicy(address(0), TOKEN_DAILY_LIMIT);

        vm.prank(guardian);
        vm.expectRevert("Zero limit");
        wallet.setTokenPolicy(address(token), 0);
    }

    function testTokenTransferPolicyEnforcesRecipientAmountAndDailyLimit() public {
        _allowTokenTransferPolicy(MockERC20.transfer.selector);

        vm.prank(agent);
        wallet.execute(address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 200 ether));

        assertEq(token.balanceOf(recipient), 200 ether);
        assertEq(token.balanceOf(address(wallet)), 800 ether);

        (, uint256 dailySpent,,) = wallet.tokenPolicy(address(token));
        assertEq(dailySpent, 200 ether);

        vm.prank(agent);
        vm.expectRevert("Amount exceeds policy");
        wallet.execute(
            address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, TOKEN_MAX_PER_CALL + 1)
        );

        vm.prank(agent);
        wallet.execute(address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 300 ether));

        vm.prank(agent);
        vm.expectRevert("Token daily limit exceeded");
        wallet.execute(address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 1));
    }

    function testTokenDailyLimitResetsAfterOneDay() public {
        _allowTokenTransferPolicy(MockERC20.transfer.selector);

        vm.prank(agent);
        wallet.execute(address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 300 ether));

        vm.prank(agent);
        wallet.execute(address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 200 ether));

        vm.prank(agent);
        vm.expectRevert("Token daily limit exceeded");
        wallet.execute(address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 1));

        vm.warp(block.timestamp + 1 days);

        vm.prank(agent);
        wallet.execute(address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, 1));

        (, uint256 dailySpent,,) = wallet.tokenPolicy(address(token));
        assertEq(dailySpent, 1);
    }

    function testTransferFromPolicyChecksRecipientAndThirdArgumentAmount() public {
        address tokenOwner = address(0xF00D1234);
        token.mint(tokenOwner, 1_000 ether);

        vm.prank(tokenOwner);
        token.approve(address(wallet), 1_000 ether);

        _allowTokenTransferPolicy(MockERC20.transferFrom.selector);

        vm.prank(agent);
        wallet.execute(
            address(token), 0, abi.encodeWithSelector(MockERC20.transferFrom.selector, tokenOwner, recipient, 200 ether)
        );

        assertEq(token.balanceOf(recipient), 200 ether);
        assertEq(token.balanceOf(tokenOwner), 800 ether);

        vm.prank(agent);
        vm.expectRevert("Recipient not allowed");
        wallet.execute(
            address(token), 0, abi.encodeWithSelector(MockERC20.transferFrom.selector, tokenOwner, attacker, 1 ether)
        );
    }

    // ---------------------------------------------------------------------
    // ETH limit changes
    // ---------------------------------------------------------------------

    function testQueueAndApplyLimitChangeAfterTimelock() public {
        vm.prank(guardian);
        wallet.queueLimitChange(0.2 ether, 1 ether);

        vm.prank(guardian);
        vm.expectRevert("Timelock active");
        wallet.applyLimitChange();

        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(guardian);
        wallet.applyLimitChange();

        assertEq(wallet.ethTxLimit(), 0.2 ether);
        assertEq(wallet.ethDailyLimit(), 1 ether);

        (,,, bool queued) = wallet.pendingLimitChange();
        assertFalse(queued);
    }

    function testLimitChangeQueueRejectsBadInputsAndDoubleQueue() public {
        vm.prank(guardian);
        vm.expectRevert("Bad limits");
        wallet.queueLimitChange(0, ETH_DAILY_LIMIT);

        vm.prank(guardian);
        vm.expectRevert("Bad limits");
        wallet.queueLimitChange(ETH_DAILY_LIMIT + 1, ETH_DAILY_LIMIT);

        vm.prank(guardian);
        wallet.queueLimitChange(0.2 ether, 1 ether);

        vm.prank(guardian);
        vm.expectRevert("Already queued");
        wallet.queueLimitChange(0.3 ether, 1 ether);
    }

    function testCancelLimitChangeClearsQueue() public {
        vm.prank(guardian);
        wallet.queueLimitChange(0.2 ether, 1 ether);

        vm.prank(guardian);
        wallet.cancelLimitChange();

        vm.prank(guardian);
        vm.expectRevert("Nothing queued");
        wallet.applyLimitChange();
    }

    function testDecreaseLimitsCannotBreakInvariantsOrRaiseLimits() public {
        vm.prank(guardian);
        vm.expectRevert("Bad limits");
        wallet.decreaseLimits(0, 0);

        vm.prank(guardian);
        vm.expectRevert("Bad limits");
        wallet.decreaseLimits(ETH_TX_LIMIT, ETH_TX_LIMIT - 1);

        vm.prank(guardian);
        vm.expectRevert("Use queueLimitChange to raise limits");
        wallet.decreaseLimits(ETH_TX_LIMIT + 1, ETH_DAILY_LIMIT);

        vm.prank(guardian);
        wallet.decreaseLimits(0.05 ether, 0.25 ether);

        assertEq(wallet.ethTxLimit(), 0.05 ether);
        assertEq(wallet.ethDailyLimit(), 0.25 ether);
    }

    function testDecreaseLimitsCancelsPendingIncrease() public {
        vm.prank(guardian);
        wallet.queueLimitChange(0.2 ether, 1 ether);

        vm.prank(guardian);
        wallet.decreaseLimits(0.05 ether, 0.25 ether);

        (,,, bool queued) = wallet.pendingLimitChange();
        assertFalse(queued);

        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(guardian);
        vm.expectRevert("Nothing queued");
        wallet.applyLimitChange();
    }

    // ---------------------------------------------------------------------
    // Role transfers
    // ---------------------------------------------------------------------

    function testTwoStepAgentTransfer() public {
        address newAgent = address(0xA6E17);
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        vm.prank(guardian);
        wallet.transferAgent(newAgent);
        assertEq(wallet.pendingAgent(), newAgent);

        vm.prank(attacker);
        vm.expectRevert("Not pending agent");
        wallet.acceptAgent();

        vm.prank(newAgent);
        wallet.acceptAgent();

        assertEq(wallet.agent(), newAgent);
        assertEq(wallet.pendingAgent(), address(0));

        vm.prank(agent);
        vm.expectRevert("Not agent");
        wallet.execute(address(target), 0, "");

        vm.prank(newAgent);
        wallet.execute(address(target), 0, "");
        assertEq(target.receiveCount(), 1);
    }

    function testRoleTransfersRejectZeroAddress() public {
        vm.prank(guardian);
        vm.expectRevert("Zero address");
        wallet.transferAgent(address(0));

        vm.prank(guardian);
        vm.expectRevert("Zero address");
        wallet.transferGuardian(address(0));
    }

    function testTwoStepGuardianTransfer() public {
        address newGuardian = address(0x6A4D1A);

        vm.prank(guardian);
        wallet.transferGuardian(newGuardian);
        assertEq(wallet.pendingGuardian(), newGuardian);

        vm.prank(attacker);
        vm.expectRevert("Not pending guardian");
        wallet.acceptGuardian();

        vm.prank(newGuardian);
        wallet.acceptGuardian();

        assertEq(wallet.guardian(), newGuardian);
        assertEq(wallet.pendingGuardian(), address(0));

        vm.prank(guardian);
        vm.expectRevert("Not guardian");
        wallet.pause();

        vm.prank(newGuardian);
        wallet.pause();
        assertTrue(wallet.paused());
    }

    // ---------------------------------------------------------------------
    // Reentrancy attack simulations
    // ---------------------------------------------------------------------

    function testReentrancyGuardBlocksNestedExecute() public {
        CallTarget safeTarget = new CallTarget();
        ReenterExecuteTarget maliciousAgentAndTarget = new ReenterExecuteTarget();
        AgentWallet reentryWallet = new AgentWallet(address(maliciousAgentAndTarget), guardian, 1 ether, 2 ether);
        vm.deal(address(reentryWallet), 1 ether);

        maliciousAgentAndTarget.setWallet(reentryWallet);
        maliciousAgentAndTarget.setNestedCall(
            address(safeTarget), abi.encodeWithSelector(CallTarget.pingNoArgs.selector)
        );

        _queueAndApplyCallFor(reentryWallet, guardian, address(maliciousAgentAndTarget), bytes4(0), false, false, 0);
        _queueAndApplyCallFor(
            reentryWallet, guardian, address(safeTarget), CallTarget.pingNoArgs.selector, false, false, 0
        );

        vm.prank(address(maliciousAgentAndTarget));
        reentryWallet.execute(address(maliciousAgentAndTarget), 0, "");

        assertTrue(maliciousAgentAndTarget.reenterAttempted());
        assertFalse(maliciousAgentAndTarget.reenterSucceeded());
        assertTrue(maliciousAgentAndTarget.reenterFailed());
        assertEq(safeTarget.pingNoArgsCount(), 0);
    }

    function testReentrancyGuardBlocksNestedWithdraw() public {
        ReenterWithdrawReceiver maliciousGuardianAndReceiver = new ReenterWithdrawReceiver();
        AgentWallet reentryWallet = new AgentWallet(agent, address(maliciousGuardianAndReceiver), 1 ether, 2 ether);
        vm.deal(address(reentryWallet), 1 ether);

        maliciousGuardianAndReceiver.setWallet(reentryWallet);
        maliciousGuardianAndReceiver.setAttackEnabled(true);

        vm.prank(address(maliciousGuardianAndReceiver));
        reentryWallet.withdraw(address(maliciousGuardianAndReceiver), 0.2 ether);

        assertEq(address(reentryWallet).balance, 0.8 ether);
        assertEq(address(maliciousGuardianAndReceiver).balance, 0.2 ether);
        assertEq(maliciousGuardianAndReceiver.receiveCount(), 1);
        assertFalse(maliciousGuardianAndReceiver.reenterSucceeded());
        assertTrue(maliciousGuardianAndReceiver.reenterFailed());
    }

    // ---------------------------------------------------------------------
    // Fuzz checks for core spending invariants
    // ---------------------------------------------------------------------

    function testFuzzValidEthSpendUpdatesDailySpent(uint256 amount) public {
        amount = bound(amount, 1, ETH_TX_LIMIT);
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        vm.prank(agent);
        wallet.execute(address(target), amount, "");

        assertEq(wallet.ethDailySpent(), amount);
        assertLe(wallet.ethDailySpent(), wallet.ethDailyLimit());
    }

    function testFuzzEthSpendAboveTxLimitReverts(uint256 amount) public {
        amount = bound(amount, ETH_TX_LIMIT + 1, 100 ether);
        _queueAndApplyCall(address(target), bytes4(0), false, false, 0);

        vm.prank(agent);
        vm.expectRevert("Exceeds ETH tx limit");
        wallet.execute(address(target), amount, "");
    }

    function testFuzzTokenTransferWithinPolicy(uint256 amount) public {
        amount = bound(amount, 1, TOKEN_MAX_PER_CALL);
        _allowTokenTransferPolicy(MockERC20.transfer.selector);

        vm.prank(agent);
        wallet.execute(address(token), 0, abi.encodeWithSelector(MockERC20.transfer.selector, recipient, amount));

        assertEq(token.balanceOf(recipient), amount);
        (, uint256 dailySpent,,) = wallet.tokenPolicy(address(token));
        assertEq(dailySpent, amount);
        assertLe(dailySpent, TOKEN_DAILY_LIMIT);
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _queueAndApplyCall(
        address callTarget,
        bytes4 selector,
        bool checkRecipient,
        bool checkAmount,
        uint256 maxAmount
    ) internal {
        _queueAndApplyCallFor(wallet, guardian, callTarget, selector, checkRecipient, checkAmount, maxAmount);
    }

    function _queueAndApplyCallFor(
        AgentWallet targetWallet,
        address walletGuardian,
        address callTarget,
        bytes4 selector,
        bool checkRecipient,
        bool checkAmount,
        uint256 maxAmount
    ) internal {
        vm.startPrank(walletGuardian);
        targetWallet.queueCall(callTarget, selector, checkRecipient, checkAmount, maxAmount);
        vm.warp(block.timestamp + 1 days + 1);
        targetWallet.applyCall();
        vm.stopPrank();
    }

    function _allowTokenTransferPolicy(bytes4 selector) internal {
        _queueAndApplyCall(address(token), selector, true, true, TOKEN_MAX_PER_CALL);

        vm.startPrank(guardian);
        wallet.addRecipient(address(token), selector, recipient);
        wallet.setTokenPolicy(address(token), TOKEN_DAILY_LIMIT);
        vm.stopPrank();
    }
}
