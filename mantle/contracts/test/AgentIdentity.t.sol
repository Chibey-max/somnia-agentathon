// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AgentIdentity.sol";

contract AgentIdentityTest is Test {
    AgentIdentity public identity;

    address public owner = address(this);
    address public agent1 = address(0xA1);
    address public agent2 = address(0xA2);
    address public stranger = address(0xBEEF);

    event IdentityMinted(uint256 indexed tokenId, address indexed agent, string name, string agentType);
    event ActionRecorded(uint256 indexed tokenId, string action, bytes32 txHash, uint256 timestamp);
    event ReputationUpdated(uint256 indexed tokenId, uint256 oldReputation, uint256 newReputation);

    function setUp() public {
        identity = new AgentIdentity();
    }

    // ─── Mint Tests ────────────────────────────────────────────────────────────

    function test_MintIdentity_Success() public {
        vm.expectEmit(true, true, false, true);
        emit IdentityMinted(1, agent1, "TestAgent", "trading");

        uint256 tokenId = identity.mintIdentity(agent1, "TestAgent", "trading");

        assertEq(tokenId, 1);
        assertEq(identity.ownerOf(tokenId), agent1);
        assertEq(identity.agentTokenId(agent1), 1);
        assertEq(identity.totalIdentities(), 1);
    }

    function test_MintIdentity_SetsProfile() public {
        uint256 tokenId = identity.mintIdentity(agent1, "MyAgent", "yield");

        AgentIdentity.AgentProfile memory profile = identity.getIdentity(tokenId);
        assertEq(profile.name, "MyAgent");
        assertEq(profile.agentType, "yield");
        assertEq(profile.reputation, 100); // Base reputation
        assertEq(profile.actionCount, 0);
        assertEq(profile.agentAddress, agent1);
        assertTrue(profile.active);
        assertGt(profile.createdAt, 0);
    }

    function test_MintIdentity_RevertsOnDuplicate() public {
        identity.mintIdentity(agent1, "Agent1", "trading");
        vm.expectRevert("AgentIdentity: agent already has identity");
        identity.mintIdentity(agent1, "Agent1Again", "trading");
    }

    function test_MintIdentity_RevertsOnZeroAddress() public {
        vm.expectRevert("AgentIdentity: zero address");
        identity.mintIdentity(address(0), "Agent", "trading");
    }

    function test_MintIdentity_RevertsOnEmptyName() public {
        vm.expectRevert("AgentIdentity: empty name");
        identity.mintIdentity(agent1, "", "trading");
    }

    function test_MintIdentity_RevertsOnEmptyType() public {
        vm.expectRevert("AgentIdentity: empty agentType");
        identity.mintIdentity(agent1, "Agent", "");
    }

    function test_MintIdentity_RevertsIfNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        identity.mintIdentity(agent1, "Agent", "trading");
    }

    function test_MintIdentity_MultipleAgents() public {
        identity.mintIdentity(agent1, "Agent1", "trading");
        identity.mintIdentity(agent2, "Agent2", "yield");

        assertEq(identity.agentTokenId(agent1), 1);
        assertEq(identity.agentTokenId(agent2), 2);
        assertEq(identity.totalIdentities(), 2);
    }

    // ─── Record Action Tests ───────────────────────────────────────────────────

    function test_RecordAction_ByAgent() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        bytes32 txHash = keccak256("tx1");

        vm.prank(agent1);
        vm.expectEmit(true, false, false, true);
        emit ActionRecorded(tokenId, "Executed swap MNT->mETH", txHash, block.timestamp);

        identity.recordAction(tokenId, "Executed swap MNT->mETH", txHash);

        AgentIdentity.AgentProfile memory profile = identity.getIdentity(tokenId);
        assertEq(profile.actionCount, 1);
        assertEq(profile.reputation, 101); // +1 reputation
    }

    function test_RecordAction_ByOwner() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        // Owner can also record actions
        identity.recordAction(tokenId, "Admin action", bytes32(0));

        AgentIdentity.AgentProfile memory profile = identity.getIdentity(tokenId);
        assertEq(profile.actionCount, 1);
    }

    function test_RecordAction_RevertsForStranger() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        vm.prank(stranger);
        vm.expectRevert("AgentIdentity: caller is not agent or owner");
        identity.recordAction(tokenId, "Hacking attempt", bytes32(0));
    }

    function test_RecordAction_UpdatesLastActive() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");
        uint256 createdAt = identity.getIdentity(tokenId).lastActive;

        vm.warp(block.timestamp + 1 hours);

        vm.prank(agent1);
        identity.recordAction(tokenId, "action", bytes32(0));

        assertGt(identity.getIdentity(tokenId).lastActive, createdAt);
    }

    function test_RecordAction_LogsAreStored() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        vm.startPrank(agent1);
        identity.recordAction(tokenId, "action1", keccak256("tx1"));
        identity.recordAction(tokenId, "action2", keccak256("tx2"));
        identity.recordAction(tokenId, "action3", keccak256("tx3"));
        vm.stopPrank();

        AgentIdentity.ActionLog[] memory logs = identity.getActionLogs(tokenId);
        assertEq(logs.length, 3);
        assertEq(logs[0].action, "action1");
        assertEq(logs[2].action, "action3");
    }

    function test_RecordAction_ReputationCappedAt1000() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        // Update reputation to 999
        identity.updateReputation(tokenId, 999);

        vm.prank(agent1);
        identity.recordAction(tokenId, "action", bytes32(0));
        assertEq(identity.getIdentity(tokenId).reputation, 1000);

        // Another action — should stay at 1000
        vm.prank(agent1);
        identity.recordAction(tokenId, "action2", bytes32(0));
        assertEq(identity.getIdentity(tokenId).reputation, 1000);
    }

    // ─── Get Recent Actions ─────────────────────────────────────────────────────

    function test_GetRecentActions() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        vm.startPrank(agent1);
        for (uint256 i = 0; i < 10; i++) {
            identity.recordAction(tokenId, string(abi.encodePacked("action", i)), bytes32(i));
        }
        vm.stopPrank();

        AgentIdentity.ActionLog[] memory recent = identity.getRecentActions(tokenId, 5);
        assertEq(recent.length, 5);
        // Should be the last 5
        assertEq(recent[4].txHash, bytes32(uint256(9)));
    }

    // ─── Reputation Tests ──────────────────────────────────────────────────────

    function test_UpdateReputation() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        vm.expectEmit(true, false, false, true);
        emit ReputationUpdated(tokenId, 100, 500);

        identity.updateReputation(tokenId, 500);
        assertEq(identity.getIdentity(tokenId).reputation, 500);
    }

    function test_UpdateReputation_RevertsAboveMax() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");
        vm.expectRevert("AgentIdentity: reputation exceeds max");
        identity.updateReputation(tokenId, 1001);
    }

    // ─── Deactivate Tests ──────────────────────────────────────────────────────

    function test_DeactivateIdentity() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");
        identity.deactivateIdentity(tokenId);
        assertFalse(identity.getIdentity(tokenId).active);
    }

    // ─── Non-Transferable Tests ────────────────────────────────────────────────

    function test_Transfer_RevertsForNonOwner() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        vm.prank(agent1);
        vm.expectRevert("AgentIdentity: identity is non-transferable");
        identity.transferFrom(agent1, agent2, tokenId);
    }

    function test_Transfer_AllowedForContractOwner() public {
        uint256 tokenId = identity.mintIdentity(agent1, "Agent1", "trading");

        // Owner (this contract) can transfer for recovery
        identity.transferFrom(agent1, agent2, tokenId);
        assertEq(identity.ownerOf(tokenId), agent2);
        assertEq(identity.agentTokenId(agent2), tokenId);
        assertEq(identity.agentTokenId(agent1), 0);
    }

    // ─── Fuzz Tests ───────────────────────────────────────────────────────────

    function testFuzz_MintAndRecord(address fuzzAgent, uint256 actionsCount) public {
        vm.assume(fuzzAgent != address(0));
        vm.assume(fuzzAgent != address(this));
        vm.assume(actionsCount > 0 && actionsCount <= 50);

        uint256 tokenId = identity.mintIdentity(fuzzAgent, "FuzzAgent", "test");

        vm.startPrank(fuzzAgent);
        for (uint256 i = 0; i < actionsCount; i++) {
            identity.recordAction(tokenId, "fuzz action", bytes32(i));
        }
        vm.stopPrank();

        AgentIdentity.AgentProfile memory profile = identity.getIdentity(tokenId);
        assertEq(profile.actionCount, actionsCount);
    }
}
