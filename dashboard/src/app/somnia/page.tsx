import {
  OverviewPanel,
  SpendingLimitsPanel,
  AgentChatPanel,
  GuardianControlPanel,
  TokenPolicyPanel,
  TransactionHistoryPanel,
} from '@/components/panels';

export const metadata = {
  title: 'Somnia Agent — Mission Control',
  description: 'Somnia Agentathon — autonomous on-chain agent dashboard',
};

export default function SomniaPage() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
        <h1 className="text-lg font-display font-semibold tracking-wide">Somnia Agent — Mission Control</h1>
        <span className="text-xs font-mono text-text-muted ml-auto">Chain ID 50312 · STT</span>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OverviewPanel />
        <SpendingLimitsPanel />
        <GuardianControlPanel />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AgentChatPanel />
        <TokenPolicyPanel />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4">
        <TransactionHistoryPanel />
      </div>

      {/* Footer */}
      <div className="border-t border-border pt-4 pb-8 flex items-center justify-between text-text-muted text-xs font-mono">
        <div className="flex items-center gap-4">
          <span>Somnia Agent Kit</span>
          <span className="text-border-bright">|</span>
          <span>AgentWallet v1</span>
          <span className="text-border-bright">|</span>
          <a
            href="https://shannon-explorer.somnia.network"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-bright transition-colors"
          >
            Somnia Explorer ↗
          </a>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span>Somnia Testnet</span>
        </div>
      </div>
    </div>
  );
}
