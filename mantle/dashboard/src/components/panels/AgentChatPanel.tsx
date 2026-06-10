"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Send, Loader2, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { getContractAddresses } from "@/lib/config";

interface ToolCall {
  tool: string;
  result: unknown;
}

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  isError?: boolean;
}

const QUICK_COMMANDS = [
  "Check my balance",
  "What are my limits?",
  "Show my identity",
  "Get MNT market data",
  "Help",
];

function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="mt-1 rounded-lg text-[10px] font-mono overflow-hidden"
      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,170,0.15)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-2.5 h-2.5 text-[var(--color-green)] flex-shrink-0" />
        ) : (
          <ChevronRight className="w-2.5 h-2.5 text-[var(--color-green)] flex-shrink-0" />
        )}
        <span style={{ color: "var(--color-green)" }}>Tool:</span>
        <span className="text-[var(--color-text-secondary)]">{toolCall.tool}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-2 overflow-auto max-h-40"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <pre className="text-[9px] whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.result, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAgent = message.role === "agent";

  const renderContent = (text: string) =>
    text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} className="leading-relaxed">
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} style={{ color: isAgent ? "var(--color-green)" : "inherit" }}>
                {p}
              </strong>
            ) : (
              p
            )
          )}
        </p>
      );
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black"
        style={
          isAgent
            ? { background: "linear-gradient(135deg, #7c3aed, #00d4aa)", color: "white" }
            : { background: "rgba(255,255,255,0.1)", color: "var(--color-text-secondary)" }
        }
      >
        {isAgent ? "M" : "U"}
      </div>

      <div className={`max-w-[80%] ${isAgent ? "" : "items-end"} flex flex-col gap-1`}>
        <div
          className="px-4 py-3 rounded-2xl text-sm"
          style={
            message.isError
              ? {
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444",
                  borderBottomLeftRadius: isAgent ? "6px" : "16px",
                  borderBottomRightRadius: isAgent ? "16px" : "6px",
                }
              : isAgent
              ? {
                  background: "rgba(17,17,24,0.9)",
                  border: "1px solid rgba(0,212,170,0.12)",
                  color: "var(--color-text-primary)",
                  borderBottomLeftRadius: "6px",
                }
              : {
                  background: "rgba(124,58,237,0.15)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  color: "white",
                  borderBottomRightRadius: "6px",
                }
          }
        >
          <div className="space-y-1 font-mono text-xs leading-relaxed">
            {renderContent(message.content)}
          </div>
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.toolCalls.map((tc, i) => (
                <ToolCallBlock key={i} toolCall={tc} />
              ))}
            </div>
          )}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] px-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </motion.div>
  );
}

export function AgentChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "agent",
      content:
        "Mantle AI Agent online. I am monitoring your wallet on Mantle Sepolia (Chain 5003). Ask me about your balances, spending limits, identity, or market data — or use the quick commands below.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      setMessages((p) => [...p, userMsg]);
      setInput("");
      setIsTyping(true);

      try {
        const addrs = getContractAddresses();
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            contractAddress: addrs?.walletAddress || "",
            identityAddress: addrs?.identityAddress || "",
          }),
        });

        const data = await res.json();

        const agentMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: data.error ? `Error: ${data.error}` : (data.response ?? "No response"),
          timestamp: new Date(),
          toolCalls: data.toolCalls || [],
          isError: !!data.error,
        };
        setMessages((p) => [...p, agentMsg]);
      } catch (err) {
        const agentMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: `Network error: ${err instanceof Error ? err.message : "unknown"}`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((p) => [...p, agentMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping]
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(0,212,170,0.12)", background: "var(--color-card)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}
      >
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-[var(--color-green)]" />
          <span className="font-bold text-white text-sm">Agent Terminal</span>
          <span className="status-badge live">
            <span className="live-dot" />
            ONLINE
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Zap className="w-3 h-3 text-[var(--color-green)]" />
          Mantle Sepolia · Chain 5003
        </div>
      </div>

      {/* Messages */}
      <div
        className="h-64 overflow-y-auto p-5 space-y-4"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-3"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                style={{ background: "linear-gradient(135deg, #7c3aed, #00d4aa)", color: "white" }}
              >
                M
              </div>
              <div
                className="px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(17,17,24,0.9)",
                  border: "1px solid rgba(0,212,170,0.12)",
                  borderBottomLeftRadius: "6px",
                }}
              >
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--color-green)" }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Commands */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => sendMessage(cmd)}
            disabled={isTyping}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105 disabled:opacity-50"
            style={{
              background: "rgba(0,212,170,0.06)",
              border: "1px solid rgba(0,212,170,0.15)",
              color: "var(--color-text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="text-[var(--color-green)] font-mono text-xs flex-shrink-0">{">"}</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage(input);
            }}
            placeholder="Ask the agent anything..."
            className="flex-1 bg-transparent text-sm text-white outline-none font-mono placeholder:text-[var(--color-text-muted)]"
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isTyping}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: input.trim() && !isTyping ? "var(--color-green)" : "rgba(255,255,255,0.06)",
            color: input.trim() && !isTyping ? "var(--color-bg)" : "var(--color-text-muted)",
            cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
          }}
        >
          {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
