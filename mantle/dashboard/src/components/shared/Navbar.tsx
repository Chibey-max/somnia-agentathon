"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart2, Fingerprint, Cpu, Zap } from "lucide-react";
import clsx from "clsx";

const navLinks = [
  { href: "/", label: "Dashboard", icon: <Activity className="w-4 h-4" /> },
  { href: "/trading", label: "Trading", icon: <BarChart2 className="w-4 h-4" /> },
  { href: "/#identity", label: "Identity", icon: <Fingerprint className="w-4 h-4" /> },
  { href: "/#skills", label: "Skills", icon: <Cpu className="w-4 h-4" /> },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 h-16"
      style={{
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,212,170,0.1)",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white transition-all duration-300 group-hover:scale-110"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #00d4aa 100%)",
              boxShadow: "0 0 16px rgba(0,212,170,0.3)",
            }}
          >
            M
          </div>
          <div>
            <span className="font-bold text-white tracking-tight">Mantle Agent</span>
            <span
              className="text-xs block font-mono leading-none"
              style={{ color: "var(--color-green)" }}
            >
              v1.0 · Mainnet
            </span>
          </div>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href) && link.href !== "/";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "text-[var(--color-green)] bg-[rgba(0,212,170,0.1)]"
                    : "text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5"
                )}
              >
                {link.icon}
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 h-0.5 w-full bg-[var(--color-green)]"
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Network Badge */}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "rgba(0,212,170,0.08)",
              border: "1px solid rgba(0,212,170,0.2)",
              color: "var(--color-green)",
            }}
          >
            <span className="live-dot w-2 h-2" />
            Mantle Mainnet
          </div>

          {/* Wallet Address */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
            style={{
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.2)",
              color: "#a78bfa",
            }}
          >
            <Zap className="w-3 h-3" />
            <span className="hidden sm:block">0x1234...abcd</span>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
