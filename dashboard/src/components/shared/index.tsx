'use client';

import { useState, ReactNode } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { formatAddress, getExplorerLink, cn } from '@/lib/utils';

// ── Panel ──────────────────────────────────────────────────────────────────
interface PanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  status?: 'ok' | 'warn' | 'error' | 'info';
  actions?: ReactNode;
  loading?: boolean;
}

export function Panel({ title, subtitle, children, className, status, actions, loading }: PanelProps) {
  const statusColor = {
    ok: 'border-green/40',
    warn: 'border-orange/60',
    error: 'border-red/60',
    info: 'border-blue-bright/40',
  }[status || 'ok'];

  return (
    <div className={cn(
      'relative bg-bg-panel border rounded-lg overflow-hidden',
      statusColor,
      className
    )}>
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #00ff88 2px, #00ff88 3px)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-green text-xs font-mono font-bold tracking-wider uppercase">{title}</span>
            {status === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />}
            {status === 'warn' && <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />}
          </div>
          {subtitle && <p className="text-text-muted text-xs mt-0.5 font-mono">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Body */}
      <div className="relative">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-text-secondary text-xs font-mono">
              <span className="animate-blink text-green">█</span>
              <span>LOADING...</span>
            </div>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ── Stat ──────────────────────────────────────────────────────────────────
interface StatProps {
  label: string;
  value: string | ReactNode;
  dim?: boolean;
  color?: 'green' | 'orange' | 'red' | 'blue' | 'default';
}

export function Stat({ label, value, dim, color = 'default' }: StatProps) {
  const valueColor = {
    green: 'text-green',
    orange: 'text-orange',
    red: 'text-red',
    blue: 'text-blue-bright',
    default: 'text-text-primary',
  }[color];

  return (
    <div className={cn('space-y-1', dim && 'opacity-60')}>
      <p className="text-text-muted text-xs font-mono uppercase tracking-wider">{label}</p>
      <p className={cn('font-mono text-sm font-bold', valueColor)}>{value}</p>
    </div>
  );
}

// ── Address ──────────────────────────────────────────────────────────────────
interface AddressDisplayProps {
  address: string;
  label?: string;
  etherscan?: boolean;
  className?: string;
}

export function AddressDisplay({ address, label, etherscan = true, className }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex items-center gap-2 group', className)}>
      {label && <span className="text-text-muted text-xs font-mono">{label}:</span>}
      <span className="text-text-primary text-xs font-mono">{formatAddress(address)}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={copy} className="text-text-muted hover:text-green transition-colors p-0.5">
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
        {etherscan && (
          <a href={getExplorerLink(address, 'address')} target="_blank" rel="noopener noreferrer"
            className="text-text-muted hover:text-blue-bright transition-colors p-0.5">
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  variant?: 'green' | 'orange' | 'red' | 'blue' | 'gray';
  pulse?: boolean;
}

export function Badge({ children, variant = 'green', pulse }: BadgeProps) {
  const styles = {
    green: 'bg-green/10 text-green border-green/30',
    orange: 'bg-orange/10 text-orange border-orange/30',
    red: 'bg-red/10 text-red border-red/30',
    blue: 'bg-blue/10 text-blue-bright border-blue/30',
    gray: 'bg-bg-elevated text-text-secondary border-border',
  }[variant];

  const pulseColor = {
    green: 'bg-green',
    orange: 'bg-orange',
    red: 'bg-red',
    blue: 'bg-blue-bright',
    gray: 'bg-text-secondary',
  }[variant];

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-bold tracking-wider uppercase', styles)}>
      {pulse && <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', pulseColor)} />}
      {children}
    </span>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showPercent?: boolean;
  warn?: number;
  danger?: number;
}

export function ProgressBar({ value, label, showPercent = true, warn = 70, danger = 90 }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const color = clamped >= danger ? '#ff3333' : clamped >= warn ? '#ff6b35' : '#00ff88';

  return (
    <div className="space-y-1">
      {(label || showPercent) && (
        <div className="flex justify-between items-center">
          {label && <span className="text-xs text-text-muted font-mono">{label}</span>}
          {showPercent && (
            <span className="text-xs font-mono font-bold" style={{ color }}>
              {clamped.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden border border-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
        />
      </div>
    </div>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger' | 'warn' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  type?: 'button' | 'submit';
}

export function Button({ children, onClick, variant = 'ghost', disabled, loading, size = 'md', className, type = 'button' }: ButtonProps) {
  const base = 'font-mono font-bold tracking-wider uppercase transition-all duration-150 rounded border disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-xs' };
  const variants = {
    primary: 'bg-green/10 border-green/50 text-green hover:bg-green/20 hover:border-green hover:shadow-green-sm',
    danger: 'bg-red/10 border-red/50 text-red hover:bg-red/20 hover:border-red',
    warn: 'bg-orange/10 border-orange/50 text-orange hover:bg-orange/20 hover:border-orange',
    ghost: 'bg-transparent border-border text-text-secondary hover:border-border-bright hover:text-text-primary',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {loading ? <><span className="animate-blink">█</span> WAIT...</> : children}
    </button>
  );
}

// ── Input ──────────────────────────────────────────────────────────────────
interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  type?: string;
}

export function Input({ value, onChange, placeholder, label, className, type = 'text' }: InputProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && <label className="text-xs text-text-muted font-mono uppercase tracking-wider">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-green/50 focus:bg-bg-hover transition-colors"
      />
    </div>
  );
}

// ── Countdown ──────────────────────────────────────────────────────────────
import { useEffect, useState as useStateCountdown } from 'react';
import { formatCountdown } from '@/lib/utils';

export function Countdown({ unlockTimeMs }: { unlockTimeMs: number }) {
  const [display, setDisplay] = useStateCountdown('--:--');
  const [nowMs, setNowMs] = useStateCountdown(0);

  useEffect(() => {
    const update = () => {
      setDisplay(formatCountdown(unlockTimeMs));
      setNowMs(Date.now());
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [unlockTimeMs]);

  const isReady = nowMs >= unlockTimeMs;
  return (
    <span className={cn('font-mono text-xs font-bold', isReady ? 'text-green' : 'text-orange')}>
      {display}
    </span>
  );
}
