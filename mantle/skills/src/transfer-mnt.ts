export interface TransferMNTInput {
  to: string;
  amount: string;
}

export interface TransferMNTOutput {
  success: boolean;
  txHash?: string;
  to: string;
  amount: string;
  error?: string;
}

export const skill = {
  name: "transfer-mnt",
  description: "Transfer native MNT from the agent wallet to a whitelisted address",
  parameters: {
    to: { type: "string", required: true, description: "Recipient address" },
    amount: { type: "string", required: true, description: "MNT amount (e.g. '1.5')" },
  },
  async execute(input: TransferMNTInput): Promise<TransferMNTOutput> {
    // Dynamic import to avoid loading viem at skill definition time
    const { executeTool } = await import("../../agent/src/executor");
    const result = await executeTool("transfer_mnt", input);
    if (!result.success) {
      return { success: false, to: input.to, amount: input.amount, error: result.error };
    }
    const data = result.data as { txHash?: string };
    return { success: true, txHash: data.txHash, to: input.to, amount: input.amount };
  },
};
