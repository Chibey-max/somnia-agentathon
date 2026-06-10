// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AgentIdentity
 * @notice ERC-8004 inspired on-chain agent identity NFT for Mantle Agentic Wallet Economy
 * @dev Each AI agent gets a soulbound-style identity token that logs its on-chain decisions
 */
contract AgentIdentity is ERC721, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    struct AgentProfile {
        string name;
        string agentType;
        uint256 reputation;
        uint256 actionCount;
        uint256 createdAt;
        uint256 lastActive;
        address agentAddress;
        bool active;
    }

    struct ActionLog {
        string action;
        bytes32 txHash;
        uint256 timestamp;
        bool success;
    }

    // tokenId => AgentProfile
    mapping(uint256 => AgentProfile) private _profiles;

    // tokenId => list of action logs
    mapping(uint256 => ActionLog[]) private _actionLogs;

    // agent address => tokenId (0 if none)
    mapping(address => uint256) public agentTokenId;

    // Maximum action logs kept per agent (ring buffer concept)
    uint256 public constant MAX_ACTION_LOGS = 100;

    // Events
    event IdentityMinted(uint256 indexed tokenId, address indexed agent, string name, string agentType);
    event ActionRecorded(uint256 indexed tokenId, string action, bytes32 txHash, uint256 timestamp);
    event ReputationUpdated(uint256 indexed tokenId, uint256 oldReputation, uint256 newReputation);

    constructor() ERC721("AgentIdentity", "AGID") Ownable(msg.sender) {}

    /**
     * @notice Mint an ERC-8004 identity NFT for an AI agent
     * @param agent The address of the agent wallet
     * @param name Human-readable name for the agent
     * @param agentType Type classification (e.g., "trading", "wallet", "yield")
     */
    function mintIdentity(
        address agent,
        string calldata name,
        string calldata agentType
    ) external onlyOwner returns (uint256) {
        require(agent != address(0), "AgentIdentity: zero address");
        require(bytes(name).length > 0, "AgentIdentity: empty name");
        require(bytes(agentType).length > 0, "AgentIdentity: empty agentType");
        require(agentTokenId[agent] == 0, "AgentIdentity: agent already has identity");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(agent, tokenId);

        _profiles[tokenId] = AgentProfile({
            name: name,
            agentType: agentType,
            reputation: 100, // Start with base reputation
            actionCount: 0,
            createdAt: block.timestamp,
            lastActive: block.timestamp,
            agentAddress: agent,
            active: true
        });

        agentTokenId[agent] = tokenId;

        emit IdentityMinted(tokenId, agent, name, agentType);
        return tokenId;
    }

    /**
     * @notice Record an on-chain action for an agent — logs decisions immutably
     * @param tokenId The agent's identity token ID
     * @param action Human-readable description of the action
     * @param txHash The transaction hash of the executed action
     */
    function recordAction(
        uint256 tokenId,
        string calldata action,
        bytes32 txHash
    ) external {
        require(_ownerOf(tokenId) != address(0), "AgentIdentity: token does not exist");
        require(
            msg.sender == _profiles[tokenId].agentAddress || msg.sender == owner(),
            "AgentIdentity: caller is not agent or owner"
        );
        require(bytes(action).length > 0, "AgentIdentity: empty action");

        ActionLog memory log = ActionLog({
            action: action,
            txHash: txHash,
            timestamp: block.timestamp,
            success: true
        });

        // Keep last MAX_ACTION_LOGS entries
        if (_actionLogs[tokenId].length >= MAX_ACTION_LOGS) {
            // Shift array — remove oldest
            for (uint256 i = 0; i < _actionLogs[tokenId].length - 1; i++) {
                _actionLogs[tokenId][i] = _actionLogs[tokenId][i + 1];
            }
            _actionLogs[tokenId][_actionLogs[tokenId].length - 1] = log;
        } else {
            _actionLogs[tokenId].push(log);
        }

        _profiles[tokenId].actionCount += 1;
        _profiles[tokenId].lastActive = block.timestamp;

        // Reputation grows with successful actions (capped at 1000)
        if (_profiles[tokenId].reputation < 1000) {
            uint256 reputationGain = 1;
            uint256 oldRep = _profiles[tokenId].reputation;
            _profiles[tokenId].reputation = oldRep + reputationGain > 1000
                ? 1000
                : oldRep + reputationGain;
            if (_profiles[tokenId].reputation != oldRep) {
                emit ReputationUpdated(tokenId, oldRep, _profiles[tokenId].reputation);
            }
        }

        emit ActionRecorded(tokenId, action, txHash, block.timestamp);
    }

    /**
     * @notice Update agent reputation directly (owner only, for slashing/rewarding)
     */
    function updateReputation(uint256 tokenId, uint256 newReputation) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "AgentIdentity: token does not exist");
        require(newReputation <= 1000, "AgentIdentity: reputation exceeds max");

        uint256 oldRep = _profiles[tokenId].reputation;
        _profiles[tokenId].reputation = newReputation;
        emit ReputationUpdated(tokenId, oldRep, newReputation);
    }

    /**
     * @notice Get an agent's full profile
     */
    function getIdentity(uint256 tokenId) external view returns (AgentProfile memory) {
        require(_ownerOf(tokenId) != address(0), "AgentIdentity: token does not exist");
        return _profiles[tokenId];
    }

    /**
     * @notice Get recent action logs for an agent
     */
    function getActionLogs(uint256 tokenId) external view returns (ActionLog[] memory) {
        require(_ownerOf(tokenId) != address(0), "AgentIdentity: token does not exist");
        return _actionLogs[tokenId];
    }

    /**
     * @notice Get the last N action logs
     */
    function getRecentActions(uint256 tokenId, uint256 count)
        external
        view
        returns (ActionLog[] memory)
    {
        require(_ownerOf(tokenId) != address(0), "AgentIdentity: token does not exist");
        ActionLog[] storage logs = _actionLogs[tokenId];
        uint256 len = logs.length;
        uint256 returnCount = count > len ? len : count;

        ActionLog[] memory result = new ActionLog[](returnCount);
        for (uint256 i = 0; i < returnCount; i++) {
            result[i] = logs[len - returnCount + i];
        }
        return result;
    }

    /**
     * @notice Total identities minted
     */
    function totalIdentities() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**
     * @notice Deactivate an agent identity (owner only)
     */
    function deactivateIdentity(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "AgentIdentity: token does not exist");
        _profiles[tokenId].active = false;
    }

    // Override transfers — identities are bound to their agent wallet
    // Allow transfers only by owner (for recovery scenarios)
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == 0) and owner-authorized transfers
        if (from != address(0) && auth != owner()) {
            revert("AgentIdentity: identity is non-transferable");
        }
        if (to != address(0) && from != address(0)) {
            // Update agent address mapping on transfer
            agentTokenId[from] = 0;
            agentTokenId[to] = tokenId;
            _profiles[tokenId].agentAddress = to;
        }
        return super._update(to, tokenId, auth);
    }
}
