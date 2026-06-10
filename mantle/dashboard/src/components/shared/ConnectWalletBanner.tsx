"use client";

import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ExternalLink, Zap } from "lucide-react";

export function ConnectWalletBanner() {
  const { isConnected } = useAccount();
  const { connect, isPending } = useConnect();

  return (
    <AnimatePresence>
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -16, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -16, height: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="overflow-hidden mb-4"
        >
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-4 rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,212,170,0.07) 0%, rgba(124,58,237,0.07) 100%)",
              border: "1px solid rgba(0,212,170,0.25)",
              boxShadow: "0 0 32px rgba(0,212,170,0.06)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(0,212,170,0.12)",
                  border: "1px solid rgba(0,212,170,0.25)",
                }}
              >
                <Wallet className="w-4 h-4 text-[var(--color-green)]" />
              </div>
              <div>
                <div className="text-sm font-bold text-white mb-0.5">
                  Connect your wallet to see live data
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Uses Mantle Sepolia testnet — no real funds required
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href="https://faucet.sepolia.mantle.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-green)] transition-colors"
              >
                Get test MNT
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => connect({ connector: injected() })}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
                style={{
                  background: isPending
                    ? "rgba(0,212,170,0.2)"
                    : "rgba(0,212,170,0.15)",
                  border: "1px solid rgba(0,212,170,0.4)",
                  color: "var(--color-green)",
                  boxShadow: isPending ? "none" : "0 0 16px rgba(0,212,170,0.2)",
                }}
              >
                {isPending ? (
                  <>
                    <Zap className="w-3.5 h-3.5 animate-pulse" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-3.5 h-3.5" />
                    Connect MetaMask
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
