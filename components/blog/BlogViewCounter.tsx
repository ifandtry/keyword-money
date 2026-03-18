"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

interface Props {
  slug: string;
  increment?: boolean;
}

export default function BlogViewCounter({ slug, increment = false }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (increment) {
      fetch("/api/blog/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
        .then((res) => res.json())
        .then((data) => setCount(data.count ?? 0))
        .catch(() => {});
    } else {
      fetch(`/api/blog/views?slug=${encodeURIComponent(slug)}`)
        .then((res) => res.json())
        .then((data) => setCount(data.count ?? 0))
        .catch(() => {});
    }
  }, [slug, increment]);

  if (count === null) return null;

  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Eye className="h-3.5 w-3.5" />
      {count.toLocaleString()}
    </span>
  );
}
