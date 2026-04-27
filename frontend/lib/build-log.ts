import raw from "@/data/build_log.json";

export type Role = "user" | "assistant";

export interface ToolCall {
  tool: string;
  summary: string;
  details?: string;
  result?: string;
}

export interface BuildMessage {
  id: string;
  role: Role;
  summary: string;
  content?: string;
  tool_calls?: ToolCall[];
}

export interface BuildSession {
  id: string;
  title: string;
  summary?: string;
  placeholder?: boolean;
  note?: string;
  messages: BuildMessage[];
}

export interface BuildLog {
  sessions: BuildSession[];
}

export const buildLog = raw as BuildLog;

export function messageToolCount(m: BuildMessage): number {
  return m.tool_calls?.length ?? 0;
}

export function sessionMessageCount(s: BuildSession): number {
  return s.messages.length;
}

export function totalToolCalls(s: BuildSession): number {
  return s.messages.reduce((acc, m) => acc + messageToolCount(m), 0);
}
