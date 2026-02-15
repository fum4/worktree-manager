import { useCallback, useEffect, useRef, useState } from "react";

import type { ActivityEvent } from "./api";
import { useServerUrlOptional } from "../contexts/ServerContext";

// Events that should trigger toast notifications
const TOAST_EVENTS = new Set([
  "creation_completed",
  "creation_failed",
  "crashed",
  "skill_failed",
  "pr_merged",
  "connection_lost",
]);

export type ActivityCategory = "agent" | "worktree" | "git" | "integration" | "system";

export function useActivityFeed(
  onToast?: (message: string, level: "error" | "info" | "success") => void,
) {
  const serverUrl = useServerUrlOptional();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<ActivityCategory | null>(null);
  const lastReadTimestamp = useRef<string | null>(null);

  // Listen for SSE activity events — these come through the existing EventSource in useWorktrees
  // We need a separate listener registration approach
  useEffect(() => {
    if (serverUrl === null) {
      setEvents([]);
      setUnreadCount(0);
      return;
    }

    // We use a custom event listener pattern — subscribe to a global event bus
    const handler = (e: CustomEvent<ActivityEvent>) => {
      const event = e.detail;
      setEvents((prev) => {
        // Avoid duplicates
        if (prev.some((p) => p.id === event.id)) return prev;
        const updated = [event, ...prev].slice(0, 200); // Keep last 200
        return updated;
      });
      setUnreadCount((c) => c + 1);

      // Fire toast for important events
      if (TOAST_EVENTS.has(event.type) && onToast) {
        const level =
          event.severity === "error" ? "error" : event.severity === "success" ? "success" : "info";
        onToast(event.title, level);
      }
    };

    const historyHandler = (e: CustomEvent<ActivityEvent[]>) => {
      setEvents((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const newEvents = e.detail.filter((ev) => !ids.has(ev.id));
        return [...prev, ...newEvents]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 200);
      });
    };

    window.addEventListener("dawg:activity", handler as EventListener);
    window.addEventListener("dawg:activity-history", historyHandler as EventListener);

    return () => {
      window.removeEventListener("dawg:activity", handler as EventListener);
      window.removeEventListener("dawg:activity-history", historyHandler as EventListener);
    };
  }, [serverUrl, onToast]);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
    if (events.length > 0) {
      lastReadTimestamp.current = events[0].timestamp;
    }
  }, [events]);

  const clearAll = useCallback(() => {
    setEvents([]);
    setUnreadCount(0);
  }, []);

  const filteredEvents = filter ? events.filter((e) => e.category === filter) : events;

  return {
    events: filteredEvents,
    allEvents: events,
    unreadCount,
    filter,
    setFilter,
    markAllRead,
    clearAll,
  };
}
