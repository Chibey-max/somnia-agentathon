export interface GetAgentIdentityInput {
  tokenId?: number;
}

export interface GetAgentIdentityOutput {
  hasIdentity: boolean;
  tokenId?: string;
  name?: string;
  agentType?: string;
  reputation?: string;
  actionCount?: string;
  createdAt?: string;
  lastActive?: string;
  recentActions?: Array<{
    action: string;
    txHash: string;
    timestamp: string;
    success: boolean;
  }>;
  error?: string;
}

export const skill = {
  name: "get-agent-identity",
  description: "Read ERC-8004 on-chain agent identity NFT data",
  parameters: {
    tokenId: { type: "number", required: false, description: "Token ID (omit for own identity)" },
  },
  async execute(input: GetAgentIdentityInput): Promise<GetAgentIdentityOutput> {
    try {
      const { executeTool } = await import("../../agent/src/executor");
      const result = await executeTool("get_agent_identity", input);
      if (!result.success) {
        return { hasIdentity: false, error: result.error };
      }
      return result.data as GetAgentIdentityOutput;
    } catch (err) {
      return { hasIdentity: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
