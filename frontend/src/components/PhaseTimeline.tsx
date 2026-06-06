"use client";

import React from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { TaskStatus, ALL_PHASES, STATUS_LABELS } from "@/lib/contracts";

interface PhaseTimelineProps {
  currentStatus: number;
}

export default function PhaseTimeline({ currentStatus }: PhaseTimelineProps) {
  const current = Number(currentStatus);

  return (
    <div className="w-full overflow-x-auto py-4">
      <div className="flex items-center min-w-[600px]">
        {ALL_PHASES.map((phase, idx) => {
          const isCompleted = current > phase;
          const isCurrent = current === phase;
          const isFuture = current < phase;

          return (
            <React.Fragment key={phase}>
              {/* Phase node */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted
                      ? "border-green-500 bg-green-500/20 text-green-400"
                      : isCurrent
                      ? "border-blue-500 bg-blue-500/20 text-blue-400 ring-4 ring-blue-500/30"
                      : "border-gray-700 bg-gray-800 text-gray-600"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-bold">{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium whitespace-nowrap ${
                    isCompleted
                      ? "text-green-400"
                      : isCurrent
                      ? "text-blue-400"
                      : "text-gray-600"
                  }`}
                >
                  {STATUS_LABELS[phase]}
                </span>
              </div>

              {/* Connector */}
              {idx < ALL_PHASES.length - 1 && (
                <div className="flex-1 mx-1">
                  <div
                    className={`h-0.5 ${
                      isCompleted ? "bg-green-500" : "bg-gray-700"
                    }`}
                  />
                  {isCurrent && (
                    <ChevronRight className="h-3 w-3 text-blue-400 -mt-1.5 mx-auto" />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
