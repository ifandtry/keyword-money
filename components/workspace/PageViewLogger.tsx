"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logClientEvent } from "@/lib/logClient";

export function PageViewLogger() {
  const pathname = usePathname();
  const prevPath = useRef("");

  useEffect(() => {
    if (pathname && pathname !== prevPath.current) {
      prevPath.current = pathname;
      logClientEvent("page_view", { page: pathname });
    }
  }, [pathname]);

  return null;
}
