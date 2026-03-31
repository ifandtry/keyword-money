import { getOrCreateAnonymousVisitorId } from "@/lib/anonymousVisitor";

export function logClientEvent(
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  if (process.env.NODE_ENV !== "production") return;

  const anonymousVisitorId = getOrCreateAnonymousVisitorId();
  const nextMetadata = anonymousVisitorId
    ? { ...metadata, anonymous_visitor_id: anonymousVisitorId }
    : metadata;

  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, metadata: nextMetadata }),
  }).catch(() => {});
}
