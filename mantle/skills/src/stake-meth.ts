export interface StakeMETHInput {
  amount: string;
}

export interface StakeMETHOutput {
  success: boolean;
  txHash?: string;
  mEthReceived?: string;
  currentApy?: string;
  error?: string;
}

export const skill = {
  name: "stake-meth",
  description: "Stake MNT to receive mETH via Mantle LSP (~4.5% APY)",
  parameters: {
    amount: { type: "string", required: true, description: "Amount of MNT to stake" },
  },
  async execute(input: StakeMETHInput): Promise<StakeMETHOutput> {
    const { stakeMNTForMETH, getYieldStats } = await import("../../agent/src/skills/yield");
    const [result, stats] = await Promise.all([
      stakeMNTForMETH(input.amount),
      getYieldStats(),
    ]);
    return {
      success: result.success,
      txHash: result.txHash,
      mEthReceived: result.mEthReceived,
      currentApy: stats.currentApy,
      error: result.error,
    };
  },
};
