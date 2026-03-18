import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-6">
        초기 사용자 모집 중
      </div>

      <h1 className="text-3xl font-bold mb-4">
        지금은 초기 사용자<br />프로그램을 운영하고 있습니다
      </h1>

      <p className="text-muted-foreground mb-8 leading-relaxed">
        키워드머니는 아직 초기 단계입니다.<br />
        네이버 블로그 후기를 작성해주시면<br />
        <span className="font-semibold text-foreground">6개월 무제한 이용권</span>을 선물로 드리고 있습니다.
      </p>

      <div className="space-y-3">
        <Link
          href="/review-program"
          className="inline-block w-full sm:w-auto px-8 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          프로그램 자세히 보기
        </Link>
        <br />
        <Link
          href="/review-program/submit"
          className="inline-block w-full sm:w-auto px-8 py-3 rounded-xl font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          후기 인증 제출하기
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mt-8">
        정식 유료 플랜은 추후 준비 중입니다
      </p>
    </div>
  );
}
