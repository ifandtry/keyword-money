"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TransformResponse } from "@/types";
import {
  Copy,
  Wand2,
  FileText,
  ListChecks,
  Lightbulb,
  ArrowRight,
} from "lucide-react";

interface Props {
  selectedKeywords: string[];
  onTransformUsed: () => boolean;
}

export function TransformSection({ selectedKeywords, onTransformUsed }: Props) {
  const [originalText, setOriginalText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransformResponse | null>(null);

  const handleTransform = async () => {
    if (!originalText.trim()) {
      toast.error("변환할 글을 입력해주세요.");
      return;
    }
    if (selectedKeywords.length === 0) {
      toast.error("위 테이블에서 키워드를 선택해주세요.");
      return;
    }
    if (!onTransformUsed()) {
      toast.error("일일 사용 한도를 초과했습니다.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: originalText.trim(),
          keywords: selectedKeywords,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "변환 실패");
      }

      const data: TransformResponse = await res.json();
      setResult(data);
      toast.success("글 변환 완료!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("복사 완료!");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          블로그 글 변환
        </h3>
        <p className="text-sm text-muted-foreground">
          기존 블로그 글을 붙여넣고, 위에서 선택한 수익 키워드를 자연스럽게
          삽입한 &ldquo;돈 되는 글&rdquo;로 변환합니다.
        </p>
      </div>

      <Textarea
        placeholder="기존 블로그 글을 여기에 붙여넣기 하세요..."
        value={originalText}
        onChange={(e) => setOriginalText(e.target.value)}
        rows={8}
        className="resize-y"
      />

      <div className="flex items-center gap-4">
        <Button
          onClick={handleTransform}
          disabled={loading || selectedKeywords.length === 0}
          size="lg"
        >
          {loading ? (
            "변환 중..."
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              돈 되는 글로 변환하기
            </>
          )}
        </Button>
        {selectedKeywords.length > 0 && (
          <span className="text-sm text-muted-foreground">
            선택된 키워드: {selectedKeywords.slice(0, 3).join(", ")}
            {selectedKeywords.length > 3 &&
              ` 외 ${selectedKeywords.length - 3}개`}
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          <Separator />

          <Tabs defaultValue="titles">
            <TabsList>
              <TabsTrigger value="titles">
                <FileText className="mr-1 h-4 w-4" />
                추천 제목
              </TabsTrigger>
              <TabsTrigger value="transformed">
                <ArrowRight className="mr-1 h-4 w-4" />
                변환된 글
              </TabsTrigger>
              <TabsTrigger value="changes">
                <ListChecks className="mr-1 h-4 w-4" />
                변경사항
              </TabsTrigger>
              <TabsTrigger value="seo">
                <Lightbulb className="mr-1 h-4 w-4" />
                SEO 팁
              </TabsTrigger>
            </TabsList>

            <TabsContent value="titles" className="space-y-3 mt-4">
              {result.titles.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border p-3 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={t.clickScore >= 80 ? "default" : "secondary"}
                      >
                        {t.clickScore}점
                      </Badge>
                      <span className="font-medium">{t.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.reason}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyText(t.title)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="transformed" className="mt-4">
              <div className="rounded-md bg-muted p-4 whitespace-pre-wrap text-sm leading-relaxed max-h-[500px] overflow-y-auto">
                {result.transformedText}
              </div>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => copyText(result.transformedText)}
              >
                <Copy className="mr-2 h-4 w-4" /> 변환된 글 복사
              </Button>
            </TabsContent>

            <TabsContent value="changes" className="mt-4">
              <ul className="space-y-2">
                {result.changes.map((change, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm"
                  >
                    <ArrowRight className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="seo" className="mt-4">
              <ul className="space-y-2">
                {result.seoTips.map((tip, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Lightbulb className="mt-0.5 h-4 w-4 text-yellow-500 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
