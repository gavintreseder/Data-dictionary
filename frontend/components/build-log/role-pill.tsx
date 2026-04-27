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
  const tone =
    role === "user"
      ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
      : role === "tool"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300";
  const label =
    role === "user" ? "User message" : role === "tool" ? "Tool call" : "Agent message";
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
        tone,
        className
      )}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}
