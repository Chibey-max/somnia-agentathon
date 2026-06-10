export type SomniaSignal = {
  sttPriceUsd: number;
  momentum: "bullish" | "neutral" | "bearish";
  confidence: number;
};

export type SomniaPolicySnapshot = {
  perActionLimitStt: number;
  dailyLimitStt: number;
  dailySpentStt: number;
  allowedTargets: string[];
};

export type SomniaDecision = {
  type: "observe" | "prepare_execution" | "blocked";
  reasoning: string;
  action?: {
    label: string;
    amountStt: number;
    targetToken: "STT" | "USDC" | "USDT";
  };
};

export async function readSomniaSignal(): Promise<SomniaSignal> {
  // Deterministic signal for demo/hackathon. Replace with live data for production.
  return {
    sttPriceUsd: 0.05,
    momentum: "bullish",
    confidence: 0.85,
  };
}

export function decideSomniaAction(signal: SomniaSignal, policy: SomniaPolicySnapshot): SomniaDecision {
  const remaining = Math.max(policy.dailyLimitStt - policy.dailySpentStt, 0);
  const proposedAmount = Math.min(0.05, policy.perActionLimitStt, remaining);

  if (remaining <= 0) {
    return {
      type: "blocked",
      reasoning: "Daily Somnia (STT) budget is exhausted. Guardian must raise or reset policy before execution.",
    };
  }

  if (signal.momentum !== "bullish" || signal.confidence < 0.7) {
    return {
      type: "observe",
      reasoning: "Somnia signal is not strong enough for autonomous execution; agent remains in observe mode.",
    };
  }

  return {
    type: "prepare_execution",
    reasoning: `Bullish Somnia signal (${Math.round(signal.confidence * 100)}% confidence) fits policy limits. Prepare AgentWallet.execute() on Somnia Testnet.`,
    action: {
      label: "Guarded STT treasury rebalance",
      amountStt: proposedAmount,
      targetToken: "STT",
    },
  };
}

export async function runSomniaAgentLoop(policy: SomniaPolicySnapshot): Promise<SomniaDecision> {
  const signal = await readSomniaSignal();
  return decideSomniaAction(signal, policy);
}

const invokedPath = process.argv[1] ?? "";
const isDirectRun = invokedPath.endsWith("somniaAgent.ts") || invokedPath.endsWith("somniaAgent.js");

if (isDirectRun) {
  void runSomniaAgentLoop({
    perActionLimitStt: 0.1,
    dailyLimitStt: 0.5,
    dailySpentStt: 0.0,
    allowedTargets: ["AgentWallet.execute", "approved-router"],
  }).then((decision) => {
    console.log(JSON.stringify(decision, null, 2));
  });
}
