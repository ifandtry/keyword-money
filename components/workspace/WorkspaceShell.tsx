"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Sidebar } from "./Sidebar";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { PageViewLogger } from "./PageViewLogger";

interface WorkspaceShellProps {
  children: React.ReactNode;
  user: User | null;
}

export function WorkspaceShell({ children, user }: WorkspaceShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <PageViewLogger />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isLoggedIn={!!user}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceHeader
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
