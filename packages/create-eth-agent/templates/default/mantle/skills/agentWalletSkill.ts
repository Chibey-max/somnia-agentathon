type AgentWalletSkillInput = {
  action: "observe" | "prepare_execution" | "explain_policy";
  amount?: number;
  targetToken?: "MNT" | "USDC" | "ETH";
};

export const agentWalletSkill = {
  name: "mantle-agent-wallet",
  description: "Use AgentWallet policy controls to explain or prepare guarded Mantle Sepolia agent actions.",
  parameters: {
    action: "observe | prepare_execution | explain_policy",
    amount: "Optional MNT amount for a proposed action",
    targetToken: "Optional target token symbol",
  },
  async execute(input: AgentWalletSkillInput) {
    if (input.action === "explain_policy") {
      return {
        ok: true,
        message: "AgentWallet enforces per-action caps, daily caps, whitelisted targets, timelocks, and guardian pause controls before Mantle execution.",
      };
    }

    if (input.action === "prepare_execution") {
      return {
        ok: true,
        mode: "dry-run",
        message: `Prepared guarded Mantle action for ${input.amount ?? 0.05} ${input.targetToken ?? "MNT"}. Submit via AgentWallet.execute() after policy preflight.`,
      };
    }

    return {
      ok: true,
      message: "Mantle agent is observing market context and wallet policy. No transaction prepared.",
    };
  },
};
