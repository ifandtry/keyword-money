export function logClientEvent(
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  if (process.env.NODE_ENV !== "production") return;

  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, metadata }),
  }).catch(() => {});
}
