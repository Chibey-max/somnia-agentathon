"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, ChevronDown, ChevronUp, CheckCircle, RefreshCw } from "lucide-react";
import { getContractAddresses, saveContractAddresses } from "@/lib/config";

const DEMO_ADDRESSES = {
  walletAddress: "0x0000000000000000000000000000000000000001",
  identityAddress: "0x0000000000000000000000000000000000000002",
  vaultAddress: "0x0000000000000000000000000000000000000003",
};

export function ContractConfigPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [identityAddress, setIdentityAddress] = useState("");
  const [vaultAddress, setVaultAddress] = useState("");

  useEffect(() => {
    const addrs = getContractAddresses();
    if (addrs) {
      setWalletAddress(addrs.walletAddress);
      setIdentityAddress(addrs.identityAddress);
      setVaultAddress(addrs.vaultAddress);
      // Auto-open if nothing is configured
      if (!addrs.walletAddress && !addrs.identityAddress && !addrs.vaultAddress) {
        setIsOpen(true);
      }
    } else {
      setIsOpen(true);
    }
  }, []);

  const hasConfig = walletAddress || identityAddress || vaultAddress;

  const handleSave = () => {
    saveContractAddresses({ walletAddress, identityAddress, vaultAddress });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUseDemos = () => {
    setWalletAddress(DEMO_ADDRESSES.walletAddress);
    setIdentityAddress(DEMO_ADDRESSES.identityAddress);
    setVaultAddress(DEMO_ADDRESSES.vaultAddress);
  };

  const handleClear = () => {
    setWalletAddress("");
    setIdentityAddress("");
    setVaultAddress("");
    saveContractAddresses({ walletAddress: "", identityAddress: "", vaultAddress: "" });
  };

  return (
    <div
      className="mb-6 rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
    >
      {/* Header toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
            Contract Configuration
          </span>
          {!hasConfig && (
            <span
              className="text-[10px] px-2 py-0.5 rounded font-mono"
              style={{
                background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.25)",
                color: "#f59e0b",
              }}
            >
              not configured
            </span>
          )}
          {hasConfig && (
            <span
              className="text-[10px] px-2 py-0.5 rounded font-mono flex items-center gap-1"
              style={{
                background: "rgba(0,212,170,0.08)",
                border: "1px solid rgba(0,212,170,0.2)",
                color: "var(--color-green)",
              }}
            >
              <CheckCircle className="w-2.5 h-2.5" />
              configured
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5 pt-1 space-y-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <p className="text-xs text-[var(--color-text-muted)]">
                Enter your deployed contract addresses on Mantle Sepolia. These are stored in your browser&apos;s localStorage.
              </p>

              <div className="grid gap-3">
                {[
                  { label: "Agent Wallet Contract Address", value: walletAddress, setter: setWalletAddress, placeholder: "0x..." },
                  { label: "Identity Contract Address", value: identityAddress, setter: setIdentityAddress, placeholder: "0x..." },
                  { label: "Trading Vault Address", value: vaultAddress, setter: setVaultAddress, placeholder: "0x..." },
                ].map(({ label, value, setter, placeholder }) => (
                  <div key={label}>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{label}</label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono text-white outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(0,212,170,0.4)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: saved ? "rgba(0,212,170,0.2)" : "rgba(0,212,170,0.12)",
                    border: "1px solid rgba(0,212,170,0.3)",
                    color: "var(--color-green)",
                  }}
                >
                  {saved ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Saved
                    </>
                  ) : (
                    "Save Addresses"
                  )}
                </button>
                <button
                  onClick={handleUseDemos}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Use Demo
                </button>
                <button
                  onClick={handleClear}
                  className="p-2 rounded-xl transition-all hover:bg-white/5"
                  style={{ color: "var(--color-text-muted)" }}
                  title="Clear all addresses"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {!hasConfig && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  No contracts? Deploy from <code className="font-mono">mantle/contracts/</code> using Foundry, or click &quot;Use Demo&quot; for placeholder addresses.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
