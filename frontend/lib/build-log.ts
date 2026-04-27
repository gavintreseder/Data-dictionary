import raw from "@/data/build_log.json";

export type Role = "user" | "assistant";

export interface ThinkingBlock {
  type: "thinking";
  text: string;
}

export interface ToolBlock {
  type: "tool";
  tool: string;
  summary: string;
  details?: string;
  result?: string;
}

export type MessageBlock = ThinkingBlock | ToolBlock;

export interface BuildMessage {
  id: string;
  role: Role;
  summary: string;
  blocks?: MessageBlock[];
}

export interface BuildSession {
  id: string;
  title: string;
  summary?: string;
  note?: string;
  messages: BuildMessage[];
}

export interface BuildLog {
  sessions: BuildSession[];
}

export const buildLog = raw as BuildLog;

export function blockCount(m: BuildMessage): number {
  return m.blocks?.length ?? 0;
}

export function toolBlockCount(m: BuildMessage): number {
  return m.blocks?.filter((b) => b.type === "tool").length ?? 0;
}

export function thinkingBlockCount(m: BuildMessage): number {
  return m.blocks?.filter((b) => b.type === "thinking").length ?? 0;
}

export function totalToolCalls(s: BuildSession): number {
  return s.messages.reduce((acc, m) => acc + toolBlockCount(m), 0);
}
