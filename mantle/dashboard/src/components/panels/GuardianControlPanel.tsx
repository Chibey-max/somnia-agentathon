"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertTriangle, Clock, RefreshCw, Pause, Play, UserCheck } from "lucide-react";
import { useState } from "react";

const PENDING_TIMELOCKS = [
  {
    id: "0xabc",
    action: "Update USDY daily limit: 1000 → 2000",
    scheduledAt: Date.now() - 6 * 60 * 60 * 1000, // 6 hours ago
    totalDelay: 48 * 60 * 60 * 1000, // 48 hours
  },
];

function CountdownTimer({ scheduledAt, totalDelay }: { scheduledAt: number; totalDelay: number }) {
  const elapsed = Date.now() - scheduledAt;
  const remaining = Math.max(0, totalDelay - elapsed);
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const pct = (elapsed / totalDelay) * 100;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--color-text-muted)]">Timelock progress</span>
        <span className="font-mono text-[var(--color-green)]">{hours}h {minutes}m remaining</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1 }}
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #7c3aed, #00d4aa)" }}
        />
      </div>
    </div>
  );
}

export function GuardianControlPanel() {
  const [halted, setHalted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="card p-5">
      <h2 className="font-bold text-white flex items-center gap-2 mb-5">
        <Shield className="w-4 h-4 text-[var(--color-green)]" />
        Guardian Controls
      </h2>

      {/* Guardian Info */}
      <div
        className="flex items-center gap-3 p-3 rounded-xl mb-4"
        style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}
        >
          <UserCheck className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-[var(--color-text-muted)]">Active Guardian</div>
          <div className="text-sm font-mono text-white">0x8f4a...3c2b</div>
        </div>
        <span
          className="ml-auto text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: "rgba(0,212,170,0.1)", color: "var(--color-green)" }}
        >
          ACTIVE
        </span>
      </div>

      {/* Emergency Pause */}
      <div className="mb-4">
        <div className="text-xs text-[var(--color-text-muted)] mb-2">Emergency Controls</div>
        <button
          onClick={() => setShowConfirm(true)}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
            halted
              ? "bg-[var(--color-green)]/15 border border-[var(--color-green)]/30 text-[var(--color-green)] hover:bg-[var(--color-green)]/25"
              : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/15"
          }`}
          style={{ boxShadow: halted ? "none" : "0 0 20px rgba(239,68,68,0.1)" }}
        >
          {halted ? (
            <>
              <Play className="w-4 h-4" />
              Resume Agent Wallet
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Emergency Pause
            </>
          )}
        </button>
      </div>

      {/* Pending Timelocks */}
      {PENDING_TIMELOCKS.length > 0 && (
        <div>
          <div className="text-xs text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending Timelock Actions
          </div>
          {PENDING_TIMELOCKS.map((action) => (
            <div
              key={action.id}
              className="p-3 rounded-xl"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <div className="text-xs text-[var(--color-text-secondary)] mb-2">{action.action}</div>
              <CountdownTimer scheduledAt={action.scheduledAt} totalDelay={action.totalDelay} />
              <div className="flex gap-2 mt-2">
                <button
                  className="flex-1 text-[10px] py-1.5 rounded-lg font-semibold transition-colors"
                  style={{ background: "rgba(0,212,170,0.1)", color: "var(--color-green)", border: "1px solid rgba(0,212,170,0.2)" }}
                >
                  Execute when ready
                </button>
                <button
                  className="flex-1 text-[10px] py-1.5 rounded-lg font-semibold transition-colors"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="card p-6 max-w-sm w-full"
              style={{ borderColor: "rgba(239,68,68,0.3)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="font-bold text-white">Emergency Pause</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">This will halt all agent activity</div>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                Pausing will immediately stop all pending transactions and prevent the agent from executing new actions. Only the guardian can resume.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--color-text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setHalted(!halted); setShowConfirm(false); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all bg-red-500 text-white hover:bg-red-600"
                >
                  Confirm Pause
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
