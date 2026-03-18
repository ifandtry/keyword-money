"use client";

import { useState } from "react";
import { ReviewProgramModal } from "@/components/ReviewProgramModal";

export function PlanBadge({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
      >
        후기 남기고 6개월 무료
      </button>
      <ReviewProgramModal
        open={showModal}
        onClose={() => setShowModal(false)}
        source="header_badge"
      />
    </>
  );
}
