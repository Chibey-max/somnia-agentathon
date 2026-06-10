// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

const COLORS = {
  bg: "#0A0E1A",
  surface: "#111827",
  surface2: "#1A2235",
  border: "#1F2937",
  green: "#00D395",
  amber: "#F5A623",
  red: "#EF4444",
  text: "#F9FAFB",
  muted: "#6B7280",
  purple: "#8B5CF6",
};

type ActivityItem = {
  id: number;
  time: string;
  type: "TRADE" | "DECISION" | "POLICY" | "SAFETY";
  title: string;
  reasoning: string;
  amount?: string;
  tx?: string;
};

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 1,
    time: "14:32",
    type: "TRADE",
    title: "Bought MNT on Merchant Moe",
    reasoning: "Momentum signal: MNT up 3.2% in 1hr, within policy limits",
    amount: "0.05 MNT",
    tx: "0x1a2b3c4d",
  },
  {
    id: 2,
    time: "14:18",
    type: "DECISION",
    title: "Held position — market volatile",
    reasoning: "High volatility detected, risk threshold exceeded. No trade.",
  },
  {
    id: 3,
    time: "13:55",
    type: "POLICY",
    title: "Daily limit window reset",
    reasoning: "New 24hr window started. Available: 1.0 MNT",
  },
  {
    id: 4,
    time: "13:40",
    type: "TRADE",
    title: "Sold ETH on Agni Finance",
    reasoning: "Take-profit target reached at +4.1%. Executed within limits.",
    amount: "0.03 MNT",
    tx: "0x9f8e7d6c",
  },
  {
    id: 5,
    time: "13:20",
    type: "SAFETY",
    title: "Transaction blocked by policy",
    reasoning:
      "Attempted trade of 0.15 MNT exceeded per-tx limit of 0.1 MNT. Contract reverted.",
  },
];

export default function MantleView() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "activity" | "policy" | "proof"
  >("overview");
  const [isLive, setIsLive] = useState(true);
  const [dailySpent, setDailySpent] = useState(0.34);
  const [perTxLimit, setPerTxLimit] = useState(0.1);
  const [dailyLimit, setDailyLimit] = useState(1.0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => !p);
      if (isLive) {
        setDailySpent((d) => Math.min(d + Math.random() * 0.01, dailyLimit));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive, dailyLimit]);

  const spentPct = (dailySpent / dailyLimit) * 100;
  const spentColor =
    spentPct > 80 ? COLORS.red : spentPct > 50 ? COLORS.amber : COLORS.green;

  return (
    <div
      style={{
        background: COLORS.bg,
        minHeight: "100vh",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: COLORS.text,
        padding: "0",
      }}
    >
      {/* Top nav */}
      <nav
        style={{
          background: COLORS.surface,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: COLORS.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#000",
            }}
          >
            E
          </div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>ETH Agent</span>
          <span
            style={{
              fontSize: 11,
              color: COLORS.muted,
              background: COLORS.surface2,
              padding: "2px 8px",
              borderRadius: 20,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            Mantle Sepolia
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: isLive ? COLORS.green : COLORS.muted,
                boxShadow: isLive && pulse ? `0 0 8px ${COLORS.green}` : "none",
                transition: "box-shadow 0.5s",
              }}
            />
            <span style={{ fontSize: 12, color: isLive ? COLORS.green : COLORS.muted }}>
              {isLive ? "LIVE" : "PAUSED"}
            </span>
          </div>

          <button
            onClick={() => setIsLive((v) => !v)}
            style={{
              background: isLive ? "rgba(239,68,68,0.1)" : "rgba(0,211,149,0.1)",
              border: `1px solid ${isLive ? COLORS.red : COLORS.green}`,
              color: isLive ? COLORS.red : COLORS.green,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.03em",
            }}
          >
            {isLive ? "Pause Agent" : "Resume Agent"}
          </button>
        </div>
      </nav>

      {/* Tab bar */}
      <div
        style={{
          background: COLORS.surface,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "0 24px",
          display: "flex",
          gap: 4,
        }}
      >
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "activity", label: "Activity Feed" },
            { id: "policy", label: "Safety Policy" },
            { id: "proof", label: "On-Chain Proof" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab.id ? COLORS.green : "transparent"}`,
              color: activeTab === tab.id ? COLORS.text : COLORS.muted,
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { label: "Trades today", value: "12", sub: "+3 from yesterday" },
                {
                  label: "Spent today",
                  value: `${dailySpent.toFixed(2)} MNT`,
                  sub: `of ${dailyLimit} MNT limit`,
                  color: spentColor,
                },
                { label: "Active since", value: "6h 14m", sub: "Mantle Sepolia" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: stat.color || COLORS.text,
                      fontFamily: "'DM Mono', monospace",
                      marginBottom: 4,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Daily limit bar */}
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>Daily spending limit</span>
                <span style={{ fontSize: 13, color: spentColor, fontFamily: "monospace" }}>
                  {dailySpent.toFixed(2)} / {dailyLimit} MNT ({spentPct.toFixed(0)}%)
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: COLORS.border,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${spentPct}%`,
                    background: spentColor,
                    borderRadius: 4,
                    transition: "width 0.5s ease, background 0.3s",
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>
                {spentPct > 80
                  ? "Warning: approaching daily limit"
                  : `${(dailyLimit - dailySpent).toFixed(2)} MNT remaining today`}
              </div>
            </div>

            {/* Last decision */}
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Latest agent decision
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: COLORS.green,
                    marginTop: 6,
                    flexShrink: 0,
                    boxShadow: pulse ? `0 0 8px ${COLORS.green}` : "none",
                    transition: "box-shadow 0.5s",
                  }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                    Bought 0.05 MNT on Merchant Moe
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
                    "Momentum signal detected: MNT up 3.2% over the last hour.
                    Trade amount (0.05 MNT) is within the per-transaction limit
                    of 0.1 MNT. Daily spend after trade: 0.34 MNT of 1.0 MNT limit."
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>
                    2 minutes ago ·{" "}
                    <a
                      href="https://explorer.sepolia.mantle.xyz"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: COLORS.green, textDecoration: "none" }}
                    >
                      View on Mantle Explorer →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVITY FEED ── */}
        {activeTab === "activity" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 13, color: COLORS.muted }}>
                All agent decisions — including ones that didn't trade
              </span>
            </div>

            {MOCK_ACTIVITY.map((item) => {
              const typeColors: Record<string, string> = {
                TRADE: COLORS.green,
                DECISION: COLORS.purple,
                POLICY: COLORS.muted,
                SAFETY: COLORS.amber,
              };
              const color = typeColors[item.type];
              return (
                <div
                  key={item.id}
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color,
                          background: `${color}18`,
                          padding: "2px 7px",
                          borderRadius: 4,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {item.type}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {item.title}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: COLORS.muted,
                        fontFamily: "monospace",
                      }}
                    >
                      {item.time}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}
                  >
                    "{item.reasoning}"
                  </div>
                  {item.tx && (
                    <div style={{ marginTop: 8, fontSize: 11 }}>
                      <span style={{ color: COLORS.muted }}>
                        {item.amount} ·{" "}
                      </span>
                      <a
                        href={`https://explorer.sepolia.mantle.xyz/tx/${item.tx}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: COLORS.green, textDecoration: "none" }}
                      >
                        {item.tx}... View on Explorer →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── POLICY ── */}
        {activeTab === "policy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                background: "rgba(245,166,35,0.08)",
                border: `1px solid ${COLORS.amber}`,
                borderRadius: 10,
                padding: 14,
                fontSize: 13,
                color: COLORS.amber,
              }}
            >
              Policy changes take effect after a 1-hour timelock. This gives
              you time to cancel if something looks wrong.
            </div>

            {[
              {
                label: "Max spend per trade",
                value: perTxLimit,
                min: 0.01,
                max: 1,
                step: 0.01,
                set: setPerTxLimit,
                unit: "MNT",
                description: "The agent cannot spend more than this in a single transaction.",
              },
              {
                label: "Daily spending limit",
                value: dailyLimit,
                min: 0.1,
                max: 10,
                step: 0.1,
                set: setDailyLimit,
                unit: "MNT",
                description:
                  "The agent cannot spend more than this across all trades in 24 hours.",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</span>
                  <span
                    style={{
                      fontSize: 14,
                      color: COLORS.green,
                      fontFamily: "monospace",
                      fontWeight: 600,
                    }}
                  >
                    {s.value.toFixed(2)} {s.unit}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
                  {s.description}
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.value}
                  onChange={(e) => s.set(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: COLORS.green, cursor: "pointer" }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: COLORS.muted,
                    marginTop: 4,
                  }}
                >
                  <span>{s.min} MNT</span>
                  <span>{s.max} MNT</span>
                </div>
              </div>
            ))}

            {/* Emergency stop */}
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                Emergency stop
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
                Immediately pauses all agent activity. Calls the guardian function
                on AgentWallet.sol — takes effect instantly, no timelock.
              </div>
              <button
                onClick={() => setIsLive(false)}
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: `1px solid ${COLORS.red}`,
                  color: COLORS.red,
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "100%",
                  letterSpacing: "0.02em",
                }}
              >
                Pause Agent Immediately
              </button>
            </div>

            <button
              style={{
                background: COLORS.green,
                border: "none",
                color: "#000",
                padding: "12px 24px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              Save Changes (1-hr timelock applies)
            </button>
          </div>
        )}

        {/* ── ON-CHAIN PROOF ── */}
        {activeTab === "proof" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>
                Every agent action is permanently recorded on Mantle. This cannot
                be edited, deleted, or hidden — it's on the blockchain.
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>
                  Contract address
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: COLORS.surface2,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: "monospace",
                      color: COLORS.text,
                      flex: 1,
                    }}
                  >
                    0x — deploy to get your address
                  </span>
                  <a
                    href="https://explorer.sepolia.mantle.xyz"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 12,
                      color: COLORS.green,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    View on Explorer →
                  </a>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                  What's verified on-chain
                </div>
                {[
                  "Every trade executed by the agent",
                  "Every policy limit enforced (and rejected txs)",
                  "Every guardian action (pause / resume)",
                  "Every timelock delay before policy changes",
                  "Every whitelisted address interaction",
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: `1px solid ${COLORS.border}`,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: COLORS.green, fontSize: 16 }}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                  Recent on-chain events
                </div>
                {[
                  { event: "TradeExecuted", detail: "0.05 MNT", block: "1,234,567" },
                  { event: "PolicyEnforced", detail: "limit=0.1 MNT", block: "1,234,501" },
                  { event: "PolicyEnforced", detail: "daily=1.0 MNT", block: "1,234,498" },
                  { event: "AgentDeployed", detail: "guardian set", block: "1,234,100" },
                ].map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      background: i % 2 === 0 ? COLORS.surface2 : "transparent",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: COLORS.green, fontFamily: "monospace" }}>
                      {ev.event}
                    </span>
                    <span style={{ color: COLORS.muted }}>{ev.detail}</span>
                    <span style={{ color: COLORS.muted, fontFamily: "monospace" }}>
                      block {ev.block}
                    </span>
                    <a
                      href="https://explorer.sepolia.mantle.xyz"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: COLORS.green, textDecoration: "none" }}
                    >
                      ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
