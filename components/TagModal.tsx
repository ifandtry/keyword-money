"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  keywords: string[];
}

type Format = "comma" | "space" | "hashComma" | "hashSpace";

const formatters: Record<Format, (keywords: string[]) => string> = {
  comma: (kw) => kw.join(", "),
  space: (kw) => kw.join(" "),
  hashComma: (kw) => kw.map((k) => `#${k}`).join(", "),
  hashSpace: (kw) => kw.map((k) => `#${k}`).join(" "),
};

export function TagModal({ open, onClose, keywords }: Props) {
  const [activeFormat, setActiveFormat] = useState<Format>("hashSpace");

  const handleCopy = async () => {
    const text = formatters[activeFormat](keywords);
    await navigator.clipboard.writeText(text);
    toast.success("태그가 복사되었습니다!");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>태그 복사 ({keywords.length}개)</DialogTitle>
        </DialogHeader>
        <Tabs
          value={activeFormat}
          onValueChange={(v) => setActiveFormat(v as Format)}
        >
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="comma">A, B, C</TabsTrigger>
            <TabsTrigger value="space">A B C</TabsTrigger>
            <TabsTrigger value="hashComma">#A, #B</TabsTrigger>
            <TabsTrigger value="hashSpace">#A #B</TabsTrigger>
          </TabsList>
          {Object.entries(formatters).map(([key, fn]) => (
            <TabsContent key={key} value={key}>
              <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap break-all min-h-[80px]">
                {fn(keywords)}
              </pre>
            </TabsContent>
          ))}
        </Tabs>
        <Button onClick={handleCopy} className="w-full">
          <Copy className="mr-2 h-4 w-4" /> 복사하기
        </Button>
      </DialogContent>
    </Dialog>
  );
}
