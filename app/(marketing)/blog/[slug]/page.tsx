import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { Badge } from "@/components/ui/badge";
import BlogViewCounter from "@/components/blog/BlogViewCounter";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} | 키워드머니`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const relatedPosts = allPosts
    .filter(
      (p) =>
        p.slug !== slug && p.tags.some((t) => post.tags.includes(t))
    )
    .slice(0, 3);

  return (
    <main className="bg-background">
      <article className="container mx-auto px-4 pt-16 pb-20">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="mb-10">
            <Link
              href="/blog"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              &larr; 블로그 목록
            </Link>
            <div className="flex items-center gap-3 mt-4">
              <time className="text-sm text-muted-foreground">
                {new Date(post.date).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <BlogViewCounter slug={slug} increment />
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl leading-tight">
              {post.title}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
              {post.description}
            </p>
            {post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 본문 */}
          <div className="prose">
            <MDXRemote source={post.content} />
          </div>

          {/* CTA */}
          <div className="mt-16 rounded-2xl bg-muted/50 border border-border/30 p-6 text-center">
            <p className="text-lg font-semibold mb-2">
              지금 바로 키워드를 분석해보세요
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              키워드머니가 수익성 높은 키워드를 AI로 찾아드립니다.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              무료로 키워드 분석하기
            </Link>
          </div>

          {/* 관련 글 */}
          {relatedPosts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-semibold mb-4">관련 글</h2>
              <div className="space-y-3">
                {relatedPosts.map((rp) => (
                  <Link
                    key={rp.slug}
                    href={`/blog/${rp.slug}`}
                    className="block rounded-xl border border-border/30 p-4 hover:border-primary/20 transition-colors"
                  >
                    <p className="font-medium text-sm">{rp.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {rp.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </main>
  );
}
