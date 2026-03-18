"use client";

import Link from "next/link";
import { useState } from "react";
import { signup } from "@/app/(auth)/actions";
import SocialLoginButtons from "@/components/SocialLoginButtons";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [signupEmail, setSignupEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signup(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.success) {
      setSignupEmail(result.email);
      setLoading(false);
    }
  }

  if (signupEmail) {
    return (
      <main className="bg-background">
        <section className="container mx-auto px-4 pt-20 pb-20">
          <div className="max-w-sm mx-auto text-center">
            <div className="rounded-2xl border border-border/30 bg-background p-8 shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">이메일을 확인해 주세요</h2>
              <p className="text-sm text-muted-foreground mb-1">
                <span className="font-medium text-foreground">{signupEmail}</span>
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                위 주소로 인증 메일을 보냈습니다.<br />
                메일의 인증 링크를 클릭하면 가입이 완료됩니다.
              </p>
              <div className="space-y-2">
                <Link
                  href="/login"
                  className="block w-full rounded-lg bg-foreground text-background py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  로그인 페이지로 이동
                </Link>
                <p className="text-xs text-muted-foreground pt-2">
                  메일이 안 왔나요? 스팸함을 확인해 보세요.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-background">
      <section className="container mx-auto px-4 pt-20 pb-20">
        <div className="max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-center mb-2">
            무료로 지금 바로 시작하기
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            가입 없이 간편 로그인, 지금 바로 돈이 되는 키워드를 찾아보세요
          </p>

          <SocialLoginButtons />

          <button
            type="button"
            onClick={() => setShowEmail(!showEmail)}
            className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showEmail ? "이메일 가입 접기 ▲" : "이메일로 가입 ▼"}
          </button>

          {showEmail && (
            <form onSubmit={handleSubmit} className="space-y-3 mt-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">이메일</label>
                <input
                  name="email"
                  type="email"
                  placeholder="이메일을 입력하세요"
                  required
                  className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">비밀번호</label>
                <input
                  name="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요 (8자 이상)"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">비밀번호 확인</label>
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-foreground text-background py-2.5 text-sm font-medium hover:opacity-90 transition-opacity mt-2 disabled:opacity-50"
              >
                {loading ? "가입 중..." : "회원가입"}
              </button>
            </form>
          )}

          <p className="text-sm text-muted-foreground text-center mt-6">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-foreground font-medium hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
