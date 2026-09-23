"use client";

import { useState } from "react";

export function useReviewSelection(refresh: () => void, initialAnnouncement = "") {
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [announcement, setAnnouncement] = useState(initialAnnouncement);

  return {
    selectedOrderId,
    announcement,
    selectOrder: setSelectedOrderId,
    closeReview: () => setSelectedOrderId(undefined),
    completeReview: (message: string) => {
      setSelectedOrderId(undefined);
      setAnnouncement(message);
      refresh();
    },
  };
}
