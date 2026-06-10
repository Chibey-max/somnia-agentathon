export type MantleSignal = {
  mntPriceUsd: number;
  momentum: "bullish" | "neutral" | "bearish";
  confidence: number;
};

export type MantlePolicySnapshot = {
  perActionLimitMnt: number;
  dailyLimitMnt: number;
  dailySpentMnt: number;
  allowedTargets: string[];
};

export type MantleDecision = {
  type: "observe" | "prepare_execution" | "blocked";
  reasoning: string;
  action?: {
    label: string;
    amountMnt: number;
    targetToken: "MNT" | "USDC" | "ETH";
  };
};

export async function readMantleSignal(): Promise<MantleSignal> {
  // Hackathon-safe deterministic signal. Replace with live price/liquidity APIs for production.
  return {
    mntPriceUsd: 1.18,
    momentum: "bullish",
    confidence: 0.82,
  };
}

export function decideMantleAction(signal: MantleSignal, policy: MantlePolicySnapshot): MantleDecision {
  const remaining = Math.max(policy.dailyLimitMnt - policy.dailySpentMnt, 0);
  const proposedAmount = Math.min(0.05, policy.perActionLimitMnt, remaining);

  if (remaining <= 0) {
    return {
      type: "blocked",
      reasoning: "Daily Mantle budget is exhausted. Guardian must raise or reset policy before execution.",
    };
  }

  if (signal.momentum !== "bullish" || signal.confidence < 0.7) {
    return {
      type: "observe",
      reasoning: "Mantle signal is not strong enough for autonomous execution; agent remains in observe mode.",
    };
  }

  return {
    type: "prepare_execution",
    reasoning: `Bullish Mantle signal (${Math.round(signal.confidence * 100)}% confidence) fits policy limits. Prepare AgentWallet.execute().`,
    action: {
      label: "Guarded MNT treasury rebalance",
      amountMnt: proposedAmount,
      targetToken: "MNT",
    },
  };
}

export async function runMantleAgentLoop(policy: MantlePolicySnapshot): Promise<MantleDecision> {
  const signal = await readMantleSignal();
  return decideMantleAction(signal, policy);
}

const invokedPath = process.argv[1] ?? "";
const isDirectRun = invokedPath.endsWith("mantleAgent.ts") || invokedPath.endsWith("mantleAgent.js");

if (isDirectRun) {
  void runMantleAgentLoop({
    perActionLimitMnt: 0.1,
    dailyLimitMnt: 0.5,
    dailySpentMnt: 0.18,
    allowedTargets: ["AgentWallet.execute", "approved-router", "approved-bridge"],
  }).then((decision) => {
    console.log(JSON.stringify(decision, null, 2));
  });
}
