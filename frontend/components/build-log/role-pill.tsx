import { Bot, User, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

export function RolePill({
  role,
  className,
}: {
  role: "user" | "assistant" | "tool";
  className?: string;
}) {
  const Icon = role === "user" ? User : role === "tool" ? Wrench : Bot;
  const label = role === "user" ? "you" : role === "tool" ? "tool" : "agent";
  const tone =
    role === "user"
      ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
      : role === "tool"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        tone,
        className
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
