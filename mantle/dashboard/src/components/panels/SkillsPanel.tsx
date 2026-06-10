"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, Layers, Repeat, Shuffle, TrendingUp, Fingerprint, Cpu, X, CheckCircle, Loader2
} from "lucide-react";
import { useState } from "react";

interface Skill {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: string;
  params?: { key: string; label: string; placeholder: string; required: boolean }[];
}

const SKILLS: Skill[] = [
  {
    id: "transfer-mnt",
    name: "Transfer MNT",
    description: "Send native MNT to a whitelisted address",
    icon: <ArrowUpRight className="w-5 h-5" />,
    color: "#00d4aa",
    category: "Transfer",
    params: [
      { key: "to", label: "Recipient", placeholder: "0x...", required: true },
      { key: "amount", label: "Amount (MNT)", placeholder: "1.0", required: true },
    ],
  },
  {
    id: "stake-meth",
    name: "Stake → mETH",
    description: "Stake MNT for ~4.5% APY via Mantle LSP",
    icon: <Layers className="w-5 h-5" />,
    color: "#7c3aed",
    category: "DeFi",
    params: [
      { key: "amount", label: "Amount (MNT)", placeholder: "10.0", required: true },
    ],
  },
  {
    id: "swap-agni",
    name: "Swap (Agni)",
    description: "Swap on Agni Finance DEX — Uniswap V3 fork",
    icon: <Repeat className="w-5 h-5" />,
    color: "#06b6d4",
    category: "DeFi",
    params: [
      { key: "tokenIn", label: "From", placeholder: "MNT", required: true },
      { key: "tokenOut", label: "To", placeholder: "METH", required: true },
      { key: "amountIn", label: "Amount", placeholder: "5.0", required: true },
    ],
  },
  {
    id: "swap-merchant-moe",
    name: "Swap (Merchant Moe)",
    description: "Swap on Merchant Moe — Joe V2.1 bins",
    icon: <Shuffle className="w-5 h-5" />,
    color: "#f59e0b",
    category: "DeFi",
    params: [
      { key: "tokenIn", label: "From", placeholder: "METH", required: true },
      { key: "tokenOut", label: "To", placeholder: "USDY", required: true },
      { key: "amountIn", label: "Amount", placeholder: "0.01", required: true },
    ],
  },
  {
    id: "execute-trade",
    name: "Execute Trade",
    description: "AI quant signal → on-chain via TradingVault",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "#10b981",
    category: "Trading",
    params: [
      { key: "symbol", label: "Symbol", placeholder: "MNTUSDT", required: true },
    ],
  },
  {
    id: "get-identity",
    name: "Read Identity",
    description: "Read ERC-8004 on-chain agent identity NFT",
    icon: <Fingerprint className="w-5 h-5" />,
    color: "#ec4899",
    category: "Identity",
    params: [],
  },
];

export function SkillsPanel() {
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleExecute = async () => {
    if (!activeSkill) return;
    setExecuting(true);
    setResult(null);
    // Simulate execution
    await new Promise((r) => setTimeout(r, 1800));
    setExecuting(false);
    setResult({ success: true, message: "Skill executed successfully on Mantle." });
  };

  return (
    <div className="card p-5">
      <h2 className="font-bold text-white flex items-center gap-2 mb-5">
        <Cpu className="w-4 h-4 text-[var(--color-green)]" />
        Agent Skills
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {SKILLS.map((skill, i) => (
          <motion.button
            key={skill.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => { setActiveSkill(skill); setFormValues({}); setResult(null); }}
            className="p-3 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${skill.color}10, ${skill.color}05)`,
              border: `1px solid ${skill.color}25`,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
              style={{ background: `${skill.color}20`, color: skill.color }}
            >
              {skill.icon}
            </div>
            <div className="text-sm font-semibold text-white leading-tight mb-1">{skill.name}</div>
            <div className="text-[10px] text-[var(--color-text-muted)] leading-tight">{skill.description}</div>
            <div
              className="mt-2 text-[9px] font-bold uppercase tracking-wider"
              style={{ color: skill.color, opacity: 0.7 }}
            >
              {skill.category}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Execution Modal */}
      <AnimatePresence>
        {activeSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setActiveSkill(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md card p-6"
              style={{ borderColor: `${activeSkill.color}30` }}
            >
              <div className="flex items-start gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${activeSkill.color}20`, color: activeSkill.color }}
                >
                  {activeSkill.icon}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">{activeSkill.name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{activeSkill.description}</div>
                </div>
                <button
                  onClick={() => setActiveSkill(null)}
                  className="p-1 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Parameters */}
              {activeSkill.params && activeSkill.params.length > 0 && (
                <div className="space-y-3 mb-5">
                  {activeSkill.params.map((param) => (
                    <div key={param.key}>
                      <label className="text-xs text-[var(--color-text-secondary)] block mb-1.5 font-medium">
                        {param.label} {param.required && <span className="text-red-400">*</span>}
                      </label>
                      <input
                        type="text"
                        placeholder={param.placeholder}
                        value={formValues[param.key] || ""}
                        onChange={(e) => setFormValues((p) => ({ ...p, [param.key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono outline-none transition-all"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${formValues[param.key] ? activeSkill.color + "40" : "rgba(255,255,255,0.1)"}`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Result */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm"
                  style={{
                    background: result.success ? "rgba(0,212,170,0.1)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${result.success ? "rgba(0,212,170,0.3)" : "rgba(239,68,68,0.3)"}`,
                    color: result.success ? "var(--color-green)" : "#ef4444",
                  }}
                >
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  {result.message}
                </motion.div>
              )}

              {/* Execute Button */}
              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: executing ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${activeSkill.color}, ${activeSkill.color}cc)`,
                  color: executing ? "var(--color-text-muted)" : "var(--color-bg)",
                  cursor: executing ? "not-allowed" : "pointer",
                }}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executing on Mantle...
                  </>
                ) : (
                  <>
                    Execute Skill
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
