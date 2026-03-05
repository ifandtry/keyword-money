import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type EventType =
  | "page_view"
  | "analyze"
  | "extract"
  | "extract_refresh"
  | "trend"
  | "login"
  | "signup"
  | "discovery"
  | "expansion"
  | "production";

export function logEvent(
  eventType: EventType,
  metadata: Record<string, unknown> = {},
  userId?: string
) {
  if (process.env.NODE_ENV !== "production") return;

  supabase
    .from("event_logs")
    .insert({ event_type: eventType, metadata, user_id: userId ?? null })
    .then(({ error }) => {
      if (error) console.error("[logEvent]", error.message);
    });
}

// OpenAI GPT-4o-mini 비용 계산
export function calcOpenAICost(usage: {
  prompt_tokens: number;
  completion_tokens: number;
}) {
  const inputCost = (usage.prompt_tokens / 1_000_000) * 0.15;
  const outputCost = (usage.completion_tokens / 1_000_000) * 0.6;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
