"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KeywordItem } from "@/types";
import { Download, Hash, ArrowUpDown, CheckSquare2, Square } from "lucide-react";

interface Props {
  items: KeywordItem[];
  selectedKeywords: Set<string>;
  onToggleKeyword: (keyword: string) => void;
  onOpenTagModal: () => void;
}

type SortKey = "profitScore" | "totalVolume" | "totalDocCount" | "saturation";

const gradeColors: Record<string, string> = {
  S: "bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:from-amber-500 hover:to-yellow-600",
  A: "bg-emerald-500 text-white hover:bg-emerald-600",
  B: "bg-blue-500 text-white hover:bg-blue-600",
  C: "bg-slate-400 text-white hover:bg-slate-500",
  D: "bg-red-400 text-white hover:bg-red-500",
};

export function KeywordTable({
  items,
  selectedKeywords,
  onToggleKeyword,
  onOpenTagModal,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("profitScore");

  const sorted = [...items].sort((a, b) => {
    if (sortKey === "saturation") return a[sortKey] - b[sortKey];
    return b[sortKey] - a[sortKey];
  });

  const handleCsvDownload = () => {
    const header = "키워드,PC검색량,모바일검색량,총검색량,총문서수,포화도,수익점수,등급,근거\n";
    const rows = sorted
      .map(
        (item) =>
          `"${item.keyword}",${item.pcVolume},${item.mobileVolume},${item.totalVolume},${item.totalDocCount},${item.saturation},${item.profitScore},${item.grade},"${item.reason}"`
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyword-analysis-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleAll = () => {
    if (selectedKeywords.size === items.length) {
      items.forEach((item) => onToggleKeyword(item.keyword));
    } else {
      items.forEach((item) => {
        if (!selectedKeywords.has(item.keyword)) onToggleKeyword(item.keyword);
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
          >
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profitScore">수익점수순</SelectItem>
              <SelectItem value="totalVolume">검색량순</SelectItem>
              <SelectItem value="totalDocCount">문서수순</SelectItem>
              <SelectItem value="saturation">포화도순</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {selectedKeywords.size}개 선택
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedKeywords.size === 0}
            onClick={onOpenTagModal}
          >
            <Hash className="mr-1 h-4 w-4" /> 태그 복사
          </Button>
          <Button variant="outline" size="sm" onClick={handleCsvDownload}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={toggleAll}>
                  {selectedKeywords.size === items.length ? (
                    <CheckSquare2 className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead>키워드</TableHead>
              <TableHead className="text-right">PC</TableHead>
              <TableHead className="text-right">모바일</TableHead>
              <TableHead className="text-right">총검색량</TableHead>
              <TableHead className="text-right">총문서수</TableHead>
              <TableHead className="text-right">포화도</TableHead>
              <TableHead className="text-right">수익점수</TableHead>
              <TableHead className="text-center">등급</TableHead>
              <TableHead>근거</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <TableRow
                key={item.keyword}
                className={
                  selectedKeywords.has(item.keyword) ? "bg-primary/5" : ""
                }
                onClick={() => onToggleKeyword(item.keyword)}
                style={{ cursor: "pointer" }}
              >
                <TableCell>
                  {selectedKeywords.has(item.keyword) ? (
                    <CheckSquare2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  {item.keyword}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.pcVolume.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.mobileVolume.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {item.totalVolume.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.totalDocCount > 0 ? item.totalDocCount.toLocaleString() : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {item.totalDocCount > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={item.saturation < 5 ? "text-green-600 font-medium" : item.saturation > 50 ? "text-red-500" : ""}>
                          {item.saturation.toFixed(1)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {item.saturation < 5 ? "블루오션! 문서 대비 검색 많음" :
                         item.saturation < 20 ? "기회 있음" :
                         item.saturation < 50 ? "보통 경쟁" : "레드오션 (문서 과포화)"}
                      </TooltipContent>
                    </Tooltip>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-right font-bold">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{item.profitScore}</span>
                    </TooltipTrigger>
                    <TooltipContent>{item.reason}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={gradeColors[item.grade]}>
                    {item.grade}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {item.reason}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
