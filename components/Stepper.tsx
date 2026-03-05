"use client";

import Link from "next/link";
import { Search, Layers, FileText } from "lucide-react";

const steps = [
  { label: "키워드 탐색", icon: Search, href: "/discovery" },
  { label: "키워드 확장", icon: Layers, href: "/analysis" },
  { label: "콘텐츠 아이디어", icon: FileText, href: "/production" },
];

interface StepperProps {
  currentStep: 1 | 2 | 3;
}

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 py-6">
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        const Icon = step.icon;

        const content = (
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isActive
                ? "bg-foreground text-background shadow-sm"
                : isCompleted
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <div
              className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${
                isActive
                  ? "bg-background text-foreground"
                  : isCompleted
                    ? "bg-primary text-white"
                    : "bg-muted-foreground/20 text-muted-foreground"
              }`}
            >
              {stepNum}
            </div>
            <Icon className="h-3.5 w-3.5 hidden sm:block" />
            <span className="hidden sm:inline">{step.label}</span>
            <span className="sm:hidden text-xs">{step.label}</span>
          </div>
        );

        return (
          <div key={stepNum} className="flex items-center gap-1 sm:gap-2">
            {idx > 0 && (
              <div
                className={`w-4 sm:w-8 h-0.5 ${
                  isCompleted || isActive ? "bg-primary/30" : "bg-border"
                }`}
              />
            )}
            {isCompleted ? (
              <Link href={step.href}>{content}</Link>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}
