// /src/services/AnalyticsService.ts
//
// Swipe analytics pipeline: writes to the Supabase `swipe_events` table
// (best-effort) with a localStorage queue fallback when offline or when the
// table is unavailable. A background flush retries queued events.
//
// NOTE: swipe_events is an append-only demo table keyed by anonymous
// device_id. It has no FKs so it works with the demo's string coupon ids.
// See supabase/migrations/*_swipe_events.sql.

import { supabase } from "@/integrations/supabase/client";

export interface SwipeEvent {
  device_id: string;
  user_id?: string | null;
  coupon_id: string;
  coupon_title?: string | null;
  brand?: string | null;
  category?: string | null;
  direction: "left" | "right";
  method: "gesture" | "button";
  decline_reason?: string | null;
  view_duration_ms: number;
  drag_distance: number;
  swipe_velocity: number;
  position: number;
  is_personalized: boolean;
  session_id: string;
  device_type: "mobile" | "desktop";
}

const QUEUE_KEY = "ppop_swipe_events_queue";
const LEGACY_KEY = "swipe_analytics";

class AnalyticsService {
  private sessionId: string;
  private sessionStartTime: number;
  private currentViewStartTime: number | null = null;
  private userId: string | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.startFlushLoop();
  }

  // ---- identity -----------------------------------------------------------

  /** Stable anonymous id for this device/browser. Used until real auth exists. */
  getDeviceId(): string {
    try {
      let id = localStorage.getItem("ppop_device_id");
      if (!id) {
        id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("ppop_device_id", id);
      }
      return id;
    } catch {
      return `dev_ephemeral_${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  /** Thread a real user id through once auth exists; falls back to device id. */
  setUserId(id: string | null | undefined) {
    this.userId = id || null;
  }

  getUserId(): string {
    return this.userId || this.getDeviceId();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // ---- view tracking ------------------------------------------------------

  startCouponView(coupon: any, context: "swipe" | "browse" | "search" | "category", position = 0) {
    this.currentViewStartTime = Date.now();
    // Views are folded into the swipe event's view_duration_ms; we only need the start time.
  }

  // ---- swipe tracking -----------------------------------------------------

  async trackSwipe(
    coupon: any,
    direction: "left" | "right",
    method: "gesture" | "button",
    dragInfo?: { distance: number; velocity: number },
    opts?: { declineReason?: string | null; position?: number }
  ): Promise<void> {
    const viewDuration =
      this.currentViewStartTime != null ? Date.now() - this.currentViewStartTime : 0;
    this.currentViewStartTime = null;

    const event: SwipeEvent = {
      device_id: this.getDeviceId(),
      user_id: this.userId,
      coupon_id: String(coupon?.id ?? "unknown"),
      coupon_title: coupon?.title ?? coupon?.description?.slice(0, 120) ?? null,
      brand: coupon?.brand ?? coupon?.brandId ?? null,
      category: coupon?.category ?? null,
      direction,
      method,
      decline_reason: direction === "left" ? opts?.declineReason ?? null : null,
      view_duration_ms: Math.max(0, viewDuration),
      drag_distance: dragInfo?.distance ?? 0,
      swipe_velocity: dragInfo?.velocity ?? 0,
      position: opts?.position ?? 0,
      is_personalized: !!(coupon?.isPersonalized || coupon?.aiGenerated),
      session_id: this.sessionId,
      device_type: window.innerWidth <= 768 ? "mobile" : "desktop",
    };

    const ok = await this.insertEvent(event);
    if (!ok) this.enqueue(event);
    this.saveLegacy(event);
  }

  /** Redemption hook for the future loyalty/checkout integration. */
  async trackRedemption(couponId: string, redemptionValue: number, storeId?: string) {
    console.log("Redemption tracked (not yet wired to backend):", {
      couponId,
      redemptionValue,
      storeId,
      userId: this.getUserId(),
      sessionId: this.sessionId,
    });
  }

  // ---- persistence --------------------------------------------------------

  private async insertEvent(event: SwipeEvent): Promise<boolean> {
    try {
      // swipe_events is added by migration and is not in the generated
      // Supabase types yet, hence the cast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("swipe_events").insert(event);
      if (error) {
        // Table may not exist yet (migration not applied) — fall back quietly.
        console.warn("swipe_events insert failed, queuing locally:", error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("swipe_events insert threw, queuing locally:", e);
      return false;
    }
  }

  private enqueue(event: SwipeEvent) {
    try {
      const q: SwipeEvent[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      q.push(event);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-500))); // cap queue
    } catch {
      /* storage unavailable */
    }
  }

  private startFlushLoop() {
    // Retry queued events every 30s; stops being relevant once the table exists.
    this.flushTimer = setInterval(() => void this.flushQueue(), 30_000);
    if (typeof (this.flushTimer as any)?.unref === "function") {
      (this.flushTimer as any).unref();
    }
  }

  async flushQueue(): Promise<void> {
    let q: SwipeEvent[];
    try {
      q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch {
      return;
    }
    if (q.length === 0) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("swipe_events").insert(q);
      if (!error) localStorage.setItem(QUEUE_KEY, "[]");
    } catch {
      /* try again later */
    }
  }

  /** Legacy localStorage log kept for backwards compatibility with old dashboards. */
  private saveLegacy(event: SwipeEvent) {
    try {
      const existing = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
      existing.push({ ...event, timestamp: Date.now() });
      localStorage.setItem(LEGACY_KEY, JSON.stringify(existing.slice(-1000)));
    } catch {
      /* ignore */
    }
  }

  // ---- dashboard helpers (local) ------------------------------------------

  async getSwipeAnalytics(filters?: {
    direction?: "left" | "right";
    dateRange?: { start: number; end: number };
  }): Promise<any[]> {
    try {
      const data = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
      return data.filter((item: any) => {
        if (filters?.direction && item.direction !== filters.direction) return false;
        if (filters?.dateRange) {
          if (item.timestamp < filters.dateRange.start || item.timestamp > filters.dateRange.end)
            return false;
        }
        return true;
      });
    } catch {
      return [];
    }
  }

  async getCampaignMetrics() {
    const analytics = await this.getSwipeAnalytics();
    const total = analytics.length;
    const accepted = analytics.filter((a) => a.direction === "right").length;
    const declined = analytics.filter((a) => a.direction === "left").length;
    const avgView =
      total > 0 ? analytics.reduce((s, a) => s + (a.view_duration_ms || 0), 0) / total : 0;
    const reasons: Record<string, number> = {};
    analytics
      .filter((a) => a.direction === "left" && a.decline_reason)
      .forEach((a) => {
        reasons[a.decline_reason] = (reasons[a.decline_reason] || 0) + 1;
      });
    return {
      totalImpressions: total,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
      declineRate: total > 0 ? (declined / total) * 100 : 0,
      averageViewSeconds: Math.round(avgView / 1000),
      declineReasons: reasons,
      gestureVsButton: {
        gesture: analytics.filter((a) => a.method === "gesture").length,
        button: analytics.filter((a) => a.method === "button").length,
      },
    };
  }

  endSession() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    void this.flushQueue();
    console.log("Analytics session ended:", this.sessionId);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const analyticsService = new AnalyticsService();
