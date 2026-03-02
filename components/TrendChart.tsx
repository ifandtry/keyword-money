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
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendEntry {
  month: string;
  [year: string]: string | number;
}

interface Props {
  keyword: string;
}

const YEAR_COLORS: Record<string, string> = {
  "2024": "#94a3b8",  // slate
  "2025": "#60a5fa",  // blue
  "2026": "#f97316",  // orange (현재)
};

export function TrendChart({ keyword }: Props) {
  const [data, setData] = useState<TrendEntry[]>([]);
  const [years, setYears] = useState<string[]>([]);
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
          setYears(d.years || []);
        }
      })
      .catch(() => setError("트렌드 데이터 로드 실패"))
      .finally(() => setLoading(false));
  }, [keyword]);

  if (error) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">월별 검색 트렌드</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
              />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(value: any, name: any) => [`${value}`, `${name}년`]} />
              <Legend formatter={(value) => `${value}년`} />
              {years.map((year) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year}
                  stroke={YEAR_COLORS[year] || "#8884d8"}
                  strokeWidth={year === String(new Date().getFullYear()) ? 3 : 1.5}
                  strokeDasharray={year === String(new Date().getFullYear()) ? undefined : "5 5"}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
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
