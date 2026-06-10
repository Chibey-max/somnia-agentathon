'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Zap, ExternalLink, Bot, Trash2 } from 'lucide-react';
import { Panel, Button } from '@/components/shared';
import { getExplorerLink, publicClient } from '@/lib/utils';
import { useAccount, useSendTransaction } from 'wagmi';
import { formatEther, isAddress, parseEther } from 'viem';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'tool' | 'error' | 'status' | 'tool_result';
  content: string;
  toolName?: string;
  txHash?: string;
  timestamp: Date;
}

interface StoredMessage extends Omit<Message, 'timestamp'> {
  timestamp: string;
}

type ChatMode = 'agentwallet' | 'direct';

type PendingDirectTransfer = {
  to: `0x${string}`;
  amount: string;
};

const CHAT_STORAGE_KEY = 'somnia-agent-chat-history-v2';

const defaultWelcomeMessage: Message = {
  id: 'welcome',
  role: 'agent',
  content: 'SomniaAgent online. Connect to your MCP server or type a goal below. I can execute on-chain actions within my policy limits.',
  timestamp: new Date(),
};

function toStoredMessages(messages: Message[]): StoredMessage[] {
  return messages.map((msg) => ({ ...msg, timestamp: msg.timestamp.toISOString() }));
}

function fromStoredMessages(raw: StoredMessage[]): Message[] {
  return raw.map((msg) => ({ ...msg, timestamp: new Date(msg.timestamp) }));
}

export function AgentChatPanel() {
  const [messages, setMessages] = useState<Message[]>([defaultWelcomeMessage]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState<ChatMode>('agentwallet');
  const [pendingDirectTransfer, setPendingDirectTransfer] = useState<PendingDirectTransfer | null>(null);
  const messageLogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { address: connectedAddress, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredMessage[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      setMessages(fromStoredMessages(parsed));
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  useEffect(() => {
    const log = messageLogRef.current;
    if (!log) return;
    log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStoredMessages(messages)));
    } catch {
      // ignore write errors (e.g. storage quota)
    }
  }, [messages]);

  const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}`, timestamp: new Date() }]);
  };

  const addAgentMessage = (content: string) => {
    if (!content?.trim()) return;
    addMessage({ role: 'agent', content: content.trim() });
  };

  const clearChat = () => {
    setMessages([{ ...defaultWelcomeMessage, id: `welcome-${Date.now()}`, timestamp: new Date() }]);
    setPendingDirectTransfer(null);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // ignore clear errors
    }
  };

  const handleDirectModeGoal = async (goal: string) => {
    if (!isConnected || !connectedAddress) {
      addMessage({ role: 'error', content: 'Direct mode requires a connected wallet.' });
      return;
    }

    const normalizedGoal = goal.trim().toLowerCase();
    const conversational = /^(hi|hello|hey|yo|gm|gn|sup)\b/i.test(normalizedGoal);
    const asksCapabilities = /(what can you do|capabilities|help|how can you help|can you send|can you transfer)/i.test(normalizedGoal);
    const thanks = /^(thanks|thank you|thx)\b/i.test(normalizedGoal);

    if (pendingDirectTransfer) {
      if (normalizedGoal === 'confirm') {
        try {
          const value = parseEther(pendingDirectTransfer.amount);
          addMessage({ role: 'status', content: 'Awaiting wallet confirmation...' });
          const hash = await sendTransactionAsync({ to: pendingDirectTransfer.to, value });
          addMessage({ role: 'tool', content: 'Transaction submitted', toolName: 'direct_send_eth', txHash: hash });
          addMessage({ role: 'agent', content: `Sent ${pendingDirectTransfer.amount} ETH from connected wallet ${connectedAddress} to ${pendingDirectTransfer.to}.` });
        } catch (error) {
          addMessage({ role: 'error', content: `Direct transfer failed: ${String(error)}` });
        } finally {
          setPendingDirectTransfer(null);
        }
        return;
      }

      if (normalizedGoal === 'cancel') {
        setPendingDirectTransfer(null);
        addMessage({ role: 'status', content: 'Pending direct transfer cancelled.' });
        return;
      }

      addMessage({ role: 'status', content: `Pending transfer: ${pendingDirectTransfer.amount} STT to ${pendingDirectTransfer.to}. Type "confirm" to send or "cancel".` });
      return;
    }

    const directEthTransfer = goal.match(/\b(?:transfer|send)\s+([0-9]+(?:\.[0-9]+)?)\s*(?:stt|eth)\s+(?:to\s+)?(0x[a-fA-F0-9]{40})\b/i);
    if (directEthTransfer) {
      const [, amount, to] = directEthTransfer;
      if (!isAddress(to)) {
        addMessage({ role: 'error', content: 'Invalid recipient address.' });
        return;
      }

      setPendingDirectTransfer({ to: to as `0x${string}`, amount });
      addMessage({ role: 'status', content: `Review transfer: send ${amount} STT from ${connectedAddress} to ${to}. Type "confirm" to proceed or "cancel".` });
      return;
    }

    const addressInGoal = goal.match(/0x[a-fA-F0-9]{40}/);
    const asksForBalance = /\b(?:check|get|read|show)?\s*(?:the\s+)?(?:(?:stt|eth)\s+)?bal(?:ance)?\b/i.test(goal)
      || /\bbalance\b/i.test(goal);

    if (addressInGoal && asksForBalance) {
      const target = addressInGoal[0] as `0x${string}`;
      const balance = await publicClient.getBalance({ address: target });
      addMessage({ role: 'agent', content: `Address ${target} has ${formatEther(balance)} STT on Somnia Testnet.` });
      return;
    }

    if (asksForBalance) {
      const balance = await publicClient.getBalance({ address: connectedAddress });
      addMessage({ role: 'agent', content: `Connected wallet ${connectedAddress} balance is ${formatEther(balance)} STT on Somnia Testnet.` });
      return;
    }

    if (thanks) {
      addMessage({ role: 'agent', content: 'Anytime — I’m here. If you want, I can help you craft the exact send command.' });
      return;
    }

    if (asksCapabilities) {
      addMessage({
        role: 'agent',
        content:
          'Absolutely. In Direct mode I can:\n• Check your connected wallet balance\n• Check STT balance of any address\n• Send STT from your connected wallet (with confirm/cancel safety)\n\nTry: "send 0.001 STT to 0x..."',
      });
      return;
    }

    if (conversational) {
      addMessage({ role: 'agent', content: 'Hey! I can help with direct STT sends and balance checks. Tell me what you want to do.' });
      return;
    }

    addMessage({ role: 'agent', content: 'I can help with direct wallet actions. Try: "send <amount> STT to 0x...", "my STT bal", or "bal of 0x...". Sends always require "confirm" before execution.' });
  };

  const sendGoal = async () => {
    const goal = input.trim();
    if (!goal || streaming) return;

    setInput('');
    addMessage({ role: 'user', content: goal });
    setStreaming(true);



    try {
      if (mode === 'direct') {
        await handleDirectModeGoal(goal);
        return;
      }

      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      });

      if (!res.ok) {
        const err = await res.json();
        addMessage({ role: 'error', content: `Error: ${err.error || 'Unknown error'}` });
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const chunk = JSON.parse(raw);
            if (chunk.type === 'text') {
              addAgentMessage(chunk.content || '');
            } else if (chunk.type === 'status') {
              addMessage({ role: 'status', content: chunk.content || '' });
            } else if (chunk.type === 'tool') {
              const argsText = chunk.args ? `\n${JSON.stringify(chunk.args, null, 2)}` : '';
              addMessage({ role: 'tool', content: `Tool call → ${chunk.name || 'unknown'}${argsText}`, toolName: chunk.name });
            } else if (chunk.type === 'tool_result') {
              const resultText = chunk.result ? JSON.stringify(chunk.result, null, 2) : chunk.content || '';
              addMessage({ role: 'tool_result', content: `Result ← ${chunk.name || 'unknown'}\n${resultText}`, toolName: chunk.name });
            } else if (chunk.type === 'tx') {
              addMessage({
                role: 'tool',
                content: `Transaction submitted`,
                toolName: 'execute',
                txHash: chunk.hash,
              });
            } else if (chunk.type === 'error') {
              addMessage({ role: 'error', content: chunk.content });
            } else if (chunk.type === 'done') {
              break;
            }
          } catch {
            // malformed chunk
          }
        }
      }
    } catch (err) {
      addMessage({ role: 'error', content: `Connection error: ${String(err)}` });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendGoal();
    }
  };

  const msgColor = {
    user: 'text-blue-bright',
    agent: 'text-text-primary',
    tool: 'text-yellow',
    tool_result: 'text-yellow',
    error: 'text-red',
    status: 'text-green',
  };

  const msgContainer = {
    user: 'bg-blue-bright/10 border border-blue-bright/30 rounded px-2 py-1',
    agent: 'bg-green/10 border border-green/30 rounded px-2 py-1',
    tool: 'bg-yellow/10 border border-yellow/30 rounded px-2 py-1',
    tool_result: 'bg-yellow/10 border border-yellow/30 rounded px-2 py-1',
    error: 'bg-red/10 border border-red/30 rounded px-2 py-1',
    status: 'bg-green/5 border border-green/20 rounded px-2 py-1 italic',
  };

  const msgPrefix = {
    user: '> ',
    agent: 'AI ',
    tool: '⊙ ',
    tool_result: '✓ ',
    error: '! ',
    status: '$ ',
  };

  return (
    <Panel
      title="Agent Chat"
      subtitle={mode === 'agentwallet' ? 'Send goals to the on-chain agent' : 'Send from connected wallet (direct mode)'}
      status={streaming ? 'info' : 'ok'}
    >
      <div className="flex flex-col h-[420px]">
        {/* Message log */}
        <div ref={messageLogRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 font-mono text-xs">
          {messages.map((msg) => (
            <div key={msg.id} className="animate-slide-in">
              <div className="flex items-start gap-2">
                <span className={`shrink-0 ${msgColor[msg.role]}`}>{msgPrefix[msg.role]}</span>
                <div className={`flex-1 min-w-0 ${msgContainer[msg.role]}`}>
                  <div className="flex items-start gap-2">
                    {msg.role === 'agent' && <Bot size={12} className="text-green mt-0.5 shrink-0" />}
                    {msg.role === 'status' && <Zap size={12} className="text-green mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      {msg.toolName && (
                        <span className="text-yellow text-xs mr-2">[{msg.toolName}]</span>
                      )}
                      <span className={`${msgColor[msg.role]} whitespace-pre-wrap break-words`}>
                        {msg.content}
                      </span>
                      {msg.txHash && (
                        <a
                          href={getExplorerLink(msg.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-bright hover:underline inline-flex items-center gap-1"
                        >
                          View on Somnia Explorer <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>

        {/* Mode selector */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-2">
          <Button size="sm" variant={mode === 'agentwallet' ? 'primary' : 'ghost'} onClick={() => setMode('agentwallet')}>
            AgentWallet Mode
          </Button>
          <Button size="sm" variant={mode === 'direct' ? 'primary' : 'ghost'} onClick={() => setMode('direct')}>
            Direct Wallet Mode
          </Button>
          <Button size="sm" variant="ghost" onClick={clearChat}>
            <span className="inline-flex items-center gap-1"><Trash2 size={12} /> Clear Chat</span>
          </Button>
          {mode === 'direct' && !isConnected && (
            <span className="text-xs text-orange font-mono">Connect wallet to enable direct sends</span>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3 flex items-center gap-3">
          <span className="text-green font-mono text-xs shrink-0">
            {streaming ? <span className="animate-blink">●</span> : '▶'}
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? 'Processing...' : mode === 'agentwallet' ? 'Enter a goal... (e.g. "send 0.001 ETH to 0x...")' : 'Direct mode: "send 0.001 ETH to 0x..."'}
            disabled={streaming}
            className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-text-primary placeholder-text-muted disabled:opacity-50"
          />
          <button
            onClick={sendGoal}
            disabled={!input.trim() || streaming}
            className="text-text-muted hover:text-green transition-colors disabled:opacity-30 p-1"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </Panel>
  );
}
