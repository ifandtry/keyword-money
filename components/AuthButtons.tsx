"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { logout } from "@/app/(auth)/actions";

export function AuthButtons({ user }: { user: User | null }) {
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {user.email}
        </span>
        <button
          onClick={() => logout()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="text-sm font-medium px-3.5 py-1.5 rounded-lg bg-muted border border-border text-foreground hover:bg-muted/70 transition-all"
      >
        로그인
      </Link>
      <Link
        href="/signup"
        className="text-sm font-medium px-3.5 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all"
      >
        회원가입
      </Link>
    </div>
  );
}
