import { NextRequest, NextResponse } from "next/server";
import { logEvent, type EventType } from "@/lib/supabase/logger";

export async function POST(req: NextRequest) {
  try {
    const { eventType, metadata, userId } = await req.json();

    if (!eventType || typeof eventType !== "string") {
      return NextResponse.json({ error: "eventType required" }, { status: 400 });
    }

    logEvent(eventType as EventType, metadata ?? {}, userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "log failed" }, { status: 500 });
  }
}
