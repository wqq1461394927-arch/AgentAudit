"use client";

import React from "react";
import { TaskStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/contracts";

interface StatusBadgeProps {
  status: number | TaskStatus;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const s = Number(status) as TaskStatus;
  const label = STATUS_LABELS[s] || "未知";
  const colorClass = STATUS_COLORS[s] || "bg-gray-500";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        colorClass
      } text-white ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full bg-white/80`} />
      {label}
    </span>
  );
}
