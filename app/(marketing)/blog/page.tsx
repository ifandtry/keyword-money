import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { Badge } from "@/components/ui/badge";
import BlogViewCounter from "@/components/blog/BlogViewCounter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "블로그 | 키워드머니",
  description:
    "네이버 블로그 수익화, 키워드 최적화, SEO 전략에 대한 실전 가이드를 제공합니다.",
};

export default function BlogListPage() {
  const posts = getAllPosts();

  return (
    <main className="bg-background">
      <section className="container mx-auto px-4 pt-16 pb-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
            블로그
          </h1>
          <p className="text-muted-foreground mb-10">
            네이버 블로그 수익화와 키워드 최적화에 대한 실전 가이드
          </p>

          {posts.length === 0 ? (
            <p className="text-muted-foreground text-center py-20">
              아직 작성된 글이 없습니다.
            </p>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="block group rounded-2xl border border-border/30 bg-background p-6 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <time className="text-xs text-muted-foreground">
                      {new Date(post.date).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    <BlogViewCounter slug={post.slug} />
                  </div>
                  <h2 className="mt-1.5 text-xl font-semibold group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {post.description}
                  </p>
                  {post.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
