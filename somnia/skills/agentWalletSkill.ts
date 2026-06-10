type AgentWalletSkillInput = {
  action: "observe" | "prepare_execution" | "explain_policy";
  amount?: number;
  targetToken?: "STT" | "USDC" | "USDT";
};

export const agentWalletSkill = {
  name: "somnia-agent-wallet",
  description: "Use AgentWallet policy controls to explain or prepare guarded Somnia Testnet agent actions.",
  parameters: {
    action: "observe | prepare_execution | explain_policy",
    amount: "Optional STT amount for a proposed action",
    targetToken: "Optional target token symbol",
  },
  async execute(input: AgentWalletSkillInput) {
    if (input.action === "explain_policy") {
      return {
        ok: true,
        message:
          "AgentWallet enforces per-action caps, daily caps, whitelisted targets, timelocks, and guardian pause controls before Somnia Testnet execution.",
      };
    }

    if (input.action === "prepare_execution") {
      return {
        ok: true,
        mode: "dry-run",
        message: `Prepared guarded Somnia action for ${input.amount ?? 0.05} ${input.targetToken ?? "STT"}. Submit via AgentWallet.execute() after policy preflight on chain 50312.`,
      };
    }

    return {
      ok: true,
      message: "Somnia agent is observing context and wallet policy. No transaction prepared.",
    };
  },
};
