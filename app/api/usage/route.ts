import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  GUEST_DISCOVERY_COOKIE,
  getGuestUsageToday,
  getUsageToday,
} from "@/lib/usage";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const guestUsage = getGuestUsageToday(
        request.cookies.get(GUEST_DISCOVERY_COOKIE)?.value
      );
      return NextResponse.json(guestUsage);
    }

    const usage = await getUsageToday(user.id);
    return NextResponse.json(usage);
  } catch {
    return NextResponse.json(getGuestUsageToday(undefined));
  }
}
