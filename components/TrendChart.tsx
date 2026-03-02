"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendData {
  month: string;
  ratio: number;
}

interface Props {
  keyword: string;
}

export function TrendChart({ keyword }: Props) {
  const [data, setData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!keyword) return;

    setLoading(true);
    setError(null);

    fetch("/api/trend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    })
      .then((res) => res.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d.trend || []);
        }
      })
      .catch(() => setError("트렌드 데이터 로드 실패"))
      .finally(() => setLoading(false));
  }, [keyword]);

  if (error) return null;

  const peakMonth = data.reduce(
    (max, d) => (d.ratio > max.ratio ? d : max),
    { month: "", ratio: 0 }
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          월별 검색 트렌드
          {peakMonth.month && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              피크: {peakMonth.month} ({peakMonth.ratio})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => v.split(".")[1] + "월"}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}`}
              />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip
                formatter={(value: any) => [`${value}`, "검색량 지수"]}
                labelFormatter={(label: any) => `${label}`}
              />
              <Line
                type="monotone"
                dataKey="ratio"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            트렌드 데이터가 없습니다
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          * 네이버 DataLab 기준 상대 검색량 (최대값 = 100)
        </p>
      </CardContent>
    </Card>
  );
}
