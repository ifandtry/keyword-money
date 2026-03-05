import Link from "next/link";
import { CoinSymbol } from "@/components/CoinSymbol";
import { createClient } from "@/lib/supabase/server";
import { AuthButtons } from "@/components/AuthButtons";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="glass border-b border-border/20">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-1.5">
            <CoinSymbol className="h-6 w-6" />
            <span className="text-lg font-bold">키워드머니</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/discovery"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium hidden sm:inline"
            >
              키워드 탐색
            </Link>
            <span className="text-border/50 hidden sm:inline">|</span>
            <Link
              href="/production"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium hidden sm:inline"
            >
              콘텐츠 아이디어
            </Link>
            <span className="text-border/50 hidden sm:inline">|</span>
            <Link
              href="/blog"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              블로그
            </Link>
            <AuthButtons user={user} />
          </nav>
        </div>
      </div>
    </header>
  );
}
