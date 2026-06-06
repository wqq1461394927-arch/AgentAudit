"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Shield, PlusCircle, Users } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "仪表盘", icon: Shield },
  { href: "/create", label: "创建任务", icon: PlusCircle },
  { href: "/agents", label: "代理节点", icon: Users },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Shield className="h-7 w-7 text-blue-500" />
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            CeatDAO
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Connect Wallet */}
        <ConnectButton
          accountStatus="address"
          chainStatus="icon"
          showBalance={false}
          label="连接钱包"
        />
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-gray-950 sm:hidden">
        <div className="flex items-center justify-around py-2">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors ${
                  isActive ? "text-blue-400" : "text-gray-500"
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
