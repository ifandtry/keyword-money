"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CoinSymbol } from "@/components/CoinSymbol";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  FileText,
  BarChart3,
  Link2,
  GitCompareArrows,
  Trophy,
  BookOpen,
  Gift,
  User,
  X,
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  comingSoon?: boolean;
  external?: boolean;
  onClick?: () => void;
  onComingSoonClick?: () => void;
}

function NavItem({ href, icon, label, active, comingSoon, external, onClick, onComingSoonClick }: NavItemProps) {
  if (comingSoon) {
    return (
      <button
        type="button"
        onClick={() => {
          onComingSoonClick?.();
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
          준비중
        </span>
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-primary/8 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="flex-1">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-6 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
      {children}
    </div>
  );
}

export function Sidebar({ open, onClose, isLoggedIn }: SidebarProps) {
  const pathname = usePathname();
  const [showComingSoon, setShowComingSoon] = useState(false);

  const keywordItems = [
    { href: "/keyword/discover", icon: <Search />, label: "키워드 탐색" },
    { href: "/keyword/ideas", icon: <FileText />, label: "콘텐츠 아이디어" },
  ];

  const blogItems = [
    { href: "/blog/top-insights", icon: <BarChart3 />, label: "상위 글 분석" },
    { href: "/blog/url-analyzer", icon: <Link2 />, label: "글 URL 분석", comingSoon: true },
    { href: "/blog/compare", icon: <GitCompareArrows />, label: "내 글 비교", comingSoon: true },
    { href: "/blog/ranking-chance", icon: <Trophy />, label: "상위노출 가능성", comingSoon: true },
  ];

  const bottomItems = [
    { href: "/blog", icon: <BookOpen />, label: "블로그 가이드", external: true },
    { href: "/review-program", icon: <Gift />, label: "후기 프로그램" },
    ...(isLoggedIn
      ? [{ href: "/account", icon: <User />, label: "내 계정" }]
      : [{ href: "/login", icon: <User />, label: "로그인" }]),
  ];

  const sidebar = (
    <aside className="flex h-full w-[220px] flex-col bg-background">
      {/* 로고 */}
      <div className="flex h-14 items-center gap-2 px-4">
        <Link href="/" className="flex items-center gap-1.5" onClick={onClose}>
          <CoinSymbol className="h-5 w-5" />
          <span className="text-base font-bold">키워드머니</span>
        </Link>
        {/* 모바일 닫기 */}
        <button
          onClick={onClose}
          className="ml-auto rounded-lg p-1 text-muted-foreground hover:text-foreground lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 메인 내비 */}
      <nav className="flex-1 overflow-y-auto px-2">
        <SectionLabel>키워드</SectionLabel>
        {keywordItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href}
            onClick={onClose}
          />
        ))}

        <SectionLabel>블로그</SectionLabel>
        {blogItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href}
            onClick={onClose}
            onComingSoonClick={() => setShowComingSoon(true)}
          />
        ))}
      </nav>

      {/* 하단 보조 */}
      <div className="border-t border-border/20 px-2 py-3 space-y-0.5">
        {bottomItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href}
            onClick={onClose}
          />
        ))}
      </div>
    </aside>
  );

  return (
    <>
      {/* 데스크탑 고정 사이드바 */}
      <div className="hidden lg:flex h-screen sticky top-0 border-r border-border/20">
        {sidebar}
      </div>

      {/* 모바일 drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden shadow-xl">
            {sidebar}
          </div>
        </>
      )}

      {/* 준비중 모달 */}
      <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>준비 중인 기능입니다</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            현재 준비 중인 기능입니다. 빠른 시일 내에 제공할 예정이니 조금만 기다려주세요!
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
