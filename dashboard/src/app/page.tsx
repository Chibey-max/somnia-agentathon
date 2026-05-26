import {
  OverviewPanel,
  SpendingLimitsPanel,
  TransactionHistoryPanel,
  WhitelistManagerPanel,
  TokenPolicyPanel,
  AgentChatPanel,
  GuardianControlPanel,
} from '@/components/panels';

export default function DashboardPage() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-4">
      {/* Top row: Overview + Spending + Guardian */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OverviewPanel />
        <SpendingLimitsPanel />
        <GuardianControlPanel />
      </div>

      {/* Middle row: Agent Chat + Whitelist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AgentChatPanel />
        <WhitelistManagerPanel />
      </div>

      {/* Bottom row: Transaction History + Token Policy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <TransactionHistoryPanel />
        </div>
        <TokenPolicyPanel />
      </div>

      {/* Footer */}
      <div className="border-t border-border pt-4 pb-8 flex items-center justify-between text-text-muted text-xs font-mono">
        <div className="flex items-center gap-4">
          <span>ETH Agent Dashboard</span>
          <span className="text-border-bright">|</span>
          <span>AgentWallet v1</span>
          <span className="text-border-bright">|</span>
          <a
            href="https://sepolia.etherscan.io/address/0xE49A6044D47De19504B73aA36F31899843B05259"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-bright transition-colors"
          >
            0xE49A...5259 ↗
          </a>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span>Sepolia Testnet</span>
        </div>
      </div>
    </div>
  );
}
