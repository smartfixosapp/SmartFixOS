import React from "react";
import NotificationCenter from "../components/notifications/NotificationCenter";

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <NotificationCenter />
      </div>
    </div>
  );
}
