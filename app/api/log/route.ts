import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logEvent, type EventType } from "@/lib/supabase/logger";

export async function POST(req: NextRequest) {
  try {
    const { eventType, metadata } = await req.json();

    if (!eventType || typeof eventType !== "string") {
      return NextResponse.json({ error: "eventType required" }, { status: 400 });
    }

    // 세션에서 userId 자동 추출
    let userId: string | undefined;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    } catch {
      // 세션 없으면 무시
    }

    logEvent(eventType as EventType, metadata ?? {}, userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "log failed" }, { status: 500 });
  }
}
