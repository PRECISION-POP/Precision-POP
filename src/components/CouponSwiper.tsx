import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform, animate } from "framer-motion";
import { MapPin, RotateCcw, X, Heart, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { personalizationService } from "../services/PersonalizationService";
import { analyticsService } from "../services/AnalyticsService";
import { Coupon, CouponSwiperProps } from "./coupon/types";
import CouponCard from "./coupon/WhiteLabelCouponCard";
import SwipeDirectionOverlay from "./coupon/SwipeDirectionOverlay";
import EmptyState from "./coupon/EmptyState";
import { DeclineReasonSheet } from "./coupon/DeclineReasonSheet";
import { CouponDetailSheet } from "./coupon/CouponDetailSheet";
import hebCoupons from "@/data/hebCoupons";

// Demo store location
const DEMO_STORE = {
  name: "H-E-B Mueller",
  address: "Austin, TX",
};

// Maximum offers a shopper can hold per trip — protects signal integrity
// ("Alice accepts everything" problem) and mirrors real wallet constraints.
const MAX_WALLET_SIZE = 15;

const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 600;

interface ExtendedSwiperProps extends CouponSwiperProps {
  onViewSaved?: () => void;
}

const CouponSwiper = ({ onCouponSwiped, userId, onViewSaved }: ExtendedSwiperProps) => {
  const { toast } = useToast();

  const [deck, setDeck] = useState<Coupon[]>([]);
  const [savedCoupons, setSavedCoupons] = useState<Coupon[]>([]);
  const [discardedCoupons, setDiscardedCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);
  const [detailCoupon, setDetailCoupon] = useState<Coupon | null>(null);
  const [declineCoupon, setDeclineCoupon] = useState<Coupon | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [deckExhausted, setDeckExhausted] = useState(false);
  // The card currently flying off-screen renders separately with its own
  // animation so the shared drag motion value can reset cleanly for the
  // incoming top card (no one-frame snap).
  const [leaving, setLeaving] = useState<{
    coupon: Coupon;
    dir: 1 | -1;
    startX: number;
    n: number;
  } | null>(null);
  const leaveCountRef = useRef(0);

  const positionRef = useRef(0); // real deck position for analytics
  const pendingDeclineRef = useRef<{
    coupon: Coupon;
    method: 'gesture' | 'button';
    dragInfo?: { distance: number; velocity: number };
    position: number;
  } | null>(null);
  const deckRef = useRef<Coupon[]>([]);
  deckRef.current = deck;

  const topCoupon = deck[0];

  // ---- motion values for the top card ----
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-14, 0, 14]);
  const bgOpacityLeft = useTransform(x, [-220, -60, 0], [0.9, 0, 0]);
  const bgOpacityRight = useTransform(x, [0, 60, 220], [0, 0, 0.9]);
  const stampScaleLeft = useTransform(x, [-220, -60, 0], [1.25, 1, 0.7]);
  const stampScaleRight = useTransform(x, [0, 60, 220], [0.7, 1, 1.25]);

  // ---- identity: stable anonymous device id unless a real user id is passed ----
  useEffect(() => {
    analyticsService.setUserId(userId || analyticsService.getDeviceId());
  }, [userId]);

  // ---- load deck: cached fallback first, then live offers, personalized interleaved ----
  useEffect(() => {
    let cancelled = false;

    const interleavePersonalized = (base: Coupon[], personalized: Coupon[]): Coupon[] => {
      if (personalized.length === 0) return base;
      const result = [...base];
      let insertAt = 2;
      personalized.forEach((pc) => {
        const withFlag = { ...pc, isPersonalized: true };
        if (!result.some((c) => c.id === withFlag.id)) {
          result.splice(Math.min(insertAt, result.length), 0, withFlag);
          insertAt += 3;
        }
      });
      return result;
    };

    const load = async () => {
      setIsLoading(true);
      setDeck([...hebCoupons]);
      setIsLoading(false);

      try {
        const { data, error } = await supabase
          .from("coupons")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (!cancelled && !error && data && data.length > 0) {
          const live: Coupon[] = data.map((c) => ({
            id: String(c.id),
            title: c.title,
            description: c.description || "",
            image: c.image_url || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400",
            value: Number(c.value) || 0,
            expiresAt: c.expiration || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            category: c.category,
            brand: c.brand,
            brandId: c.brand_id,
            campaignId: c.campaign_id,
          }));
          // Merge: live offers first, keep any fallback not duplicated
          setDeck((prev) => {
            const ids = new Set(live.map((c) => c.id));
            return [...live, ...prev.filter((c) => !ids.has(c.id))];
          });
        }
      } catch (e) {
        console.error("Using cached coupons:", e);
      }

      try {
        const personalized = await personalizationService.getPersonalizedCoupons(
          userId || analyticsService.getDeviceId()
        );
        if (!cancelled && personalized.length > 0) {
          setDeck((prev) => interleavePersonalized(prev, personalized as Coupon[]));
        }
      } catch (e) {
        console.error("Personalized coupons unavailable:", e);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- hint: show once ever, not on every card ----
  useEffect(() => {
    try {
      if (!localStorage.getItem("ppop_hint_seen")) setShowHint(true);
    } catch {
      setShowHint(true);
    }
  }, []);

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem("ppop_hint_seen", "1");
    } catch {
      /* ignore */
    }
  };

  // ---- view tracking with the real deck position ----
  useEffect(() => {
    if (topCoupon) {
      analyticsService.startCouponView(topCoupon, "swipe", positionRef.current);
    }
    if (deck.length === 0 && !isLoading) {
      setDeckExhausted(true);
    }
  }, [topCoupon, deck.length, isLoading]);

  // ---- preload the next card images ----
  useEffect(() => {
    [deck[1], deck[2]].forEach((c) => {
      if (c?.image) {
        const img = new Image();
        img.src = c.image;
      }
    });
  }, [deck]);

  const triggerHaptic = (type: "light" | "medium" | "heavy") => {
    // navigator.vibrate is Android-only; iOS Safari ignores it. No web API
    // exists for iOS haptics, so we degrade silently there.
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate({ light: 10, medium: 25, heavy: 50 }[type]);
      } catch {
        /* ignore */
      }
    }
  };

  const flushDecline = useCallback((reason: string | null) => {
    const pending = pendingDeclineRef.current;
    pendingDeclineRef.current = null;
    setDeclineCoupon(null);
    if (!pending) return;
    analyticsService.trackSwipe(
      pending.coupon,
      "left",
      pending.method,
      pending.dragInfo,
      { declineReason: reason, position: pending.position }
    );
  }, []);

  const handleSwipe = useCallback(
    async (swipeDirection: "left" | "right", method: "gesture" | "button" = "gesture") => {
      const current = deckRef.current[0];
      if (!current || isSwiping) return;

      // Wallet capacity: protect signal integrity, mirror real wallet constraints
      if (swipeDirection === "right" && savedCoupons.length >= MAX_WALLET_SIZE) {
        toast({
          title: "Wallet full",
          description: `You can hold ${MAX_WALLET_SIZE} offers per trip. Remove one from Saved to add another.`,
        });
        animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
        return;
      }

      setIsSwiping(true);
      dismissHint();
      triggerHaptic("medium");

      const position = positionRef.current++;
      const dragInfo = { distance: Math.abs(x.get()), velocity: Math.abs(x.getVelocity()) };
      const dirSign = swipeDirection === "right" ? 1 : -1;

      // Hand the exiting card to its own animated layer, starting exactly
      // where the drag (or button press) left it, then fly it past the
      // viewport edge with natural rotation. Resetting the shared x in the
      // same commit is paint-safe: the old top card unmounts simultaneously.
      const startX = method === "gesture" ? x.get() : 0;
      x.set(0);
      setLeaving({
        coupon: current,
        dir: dirSign as 1 | -1,
        startX,
        n: leaveCountRef.current++,
      });

      // Remove the top card; the stack promotes underneath with a spring
      setDeck((prev) => prev.slice(1));

      if (swipeDirection === "right") {
        setSavedCoupons((prev) =>
          prev.some((c) => c.id === current.id) ? prev : [...prev, current]
        );
        toast({
          title: "Saved",
          description: `${current.title} — ${current.description.slice(0, 48)}${current.description.length > 48 ? "…" : ""}`,
          duration: 2000,
        });
        analyticsService.trackSwipe(current, "right", method, dragInfo, { position });
      } else {
        setDiscardedCoupons((prev) => [...prev, current]);
        // Capture the structured decline reason — this is the core data asset.
        // The event flushes when the sheet resolves (reason or dismissed).
        pendingDeclineRef.current = { coupon: current, method, dragInfo, position };
        setDeclineCoupon(current);
      }

      if (onCouponSwiped) onCouponSwiped(current.id, swipeDirection);

      setIsSwiping(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSwiping, savedCoupons.length, onCouponSwiped, toast]
  );

  const handleDragEnd = async (_e: unknown, info: PanInfo) => {
    if (isSwiping || declineCoupon || detailCoupon) return;

    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (offset > SWIPE_THRESHOLD || (offset > 40 && velocity > VELOCITY_THRESHOLD)) {
      await handleSwipe("right", "gesture");
    } else if (offset < -SWIPE_THRESHOLD || (offset < -40 && velocity < -VELOCITY_THRESHOLD)) {
      await handleSwipe("left", "gesture");
    } else {
      if (Math.abs(offset) > 12) triggerHaptic("light");
      animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
    }
  };

  const handleRecoverLast = () => {
    setDiscardedCoupons((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setDeck((d) => [last, ...d]);
      setDeckExhausted(false);
      return prev.slice(0, -1);
    });
    triggerHaptic("light");
  };

  const handleReshuffle = () => {
    const all = [...deckRef.current, ...discardedCoupons];
    // simple shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    setDiscardedCoupons([]);
    setDeck(all);
    setDeckExhausted(false);
    positionRef.current = 0;
  };

  // ---- keyboard access: arrows work like the buttons ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detailCoupon || declineCoupon) return;
      if (e.key === "ArrowRight") handleSwipe("right", "button");
      else if (e.key === "ArrowLeft") handleSwipe("left", "button");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSwipe, detailCoupon, declineCoupon]);

  const totalSavings = savedCoupons.reduce((t, c) => t + (Number(c.value) || 0), 0);
  const walletFull = savedCoupons.length >= MAX_WALLET_SIZE;

  return (
    <div className="relative w-full flex flex-col gap-3">
      {/* ===== DECK AREA — contained in flow, tabs stay reachable ===== */}
      <div className="relative w-full h-[58dvh] min-h-[400px] max-h-[600px]">
        {isLoading || deck.length === 0 ? (
          <div className="absolute inset-0 rounded-3xl overflow-hidden bg-black flex items-center justify-center">
            <EmptyState isLoading={isLoading} />
          </div>
        ) : (
          <div className="absolute inset-0 rounded-3xl overflow-hidden bg-black shadow-2xl">
            <AnimatePresence initial={false}>
              {/* Card flying off-screen after a committed swipe */}
              {leaving && (
                <motion.div
                  key={`leaving-${leaving.coupon.id}-${leaving.n}`}
                  className="absolute inset-0 z-30"
                  initial={{ x: leaving.startX, rotate: leaving.startX / 16 }}
                  animate={{
                    x: leaving.dir * (window.innerWidth * 1.25 + 80),
                    rotate: leaving.dir * 22,
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  onAnimationComplete={() => setLeaving(null)}
                >
                  <CouponCard coupon={leaving.coupon} />
                </motion.div>
              )}
              {deck.slice(0, 3).map((coupon, i) => {
                const isTop = i === 0;
                return (
                  <motion.div
                    key={coupon.id}
                    className="absolute inset-0"
                    style={isTop ? { x, rotate } : undefined}
                    initial={{ scale: 0.94, opacity: 0, y: 24 }}
                    animate={{
                      scale: 1 - i * 0.055,
                      y: i * 16,
                      opacity: 1 - i * 0.18,
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    drag={isTop ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.75}
                    onDragEnd={handleDragEnd}
                    onTap={() => {
                      // Tap (not drag) opens the detail sheet
                      if (isTop && Math.abs(x.get()) < 12) setDetailCoupon(coupon);
                    }}
                    whileDrag={isTop ? { scale: 1.02, cursor: "grabbing" } : undefined}
                    whileTap={isTop ? { cursor: "grabbing" } : undefined}
                  >
                    {isTop && (
                      <SwipeDirectionOverlay
                        bgOpacityLeft={bgOpacityLeft}
                        bgOpacityRight={bgOpacityRight}
                        stampScaleLeft={stampScaleLeft}
                        stampScaleRight={stampScaleRight}
                        isPersonalized={coupon.isPersonalized}
                        isAiGenerated={coupon.aiGenerated}
                      />
                    )}
                    <CouponCard coupon={coupon} />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Top: check-in pill */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
                <MapPin className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-white">{DEMO_STORE.name}</span>
              </div>
            </div>

            {/* Top-right: savings counter */}
            <AnimatePresence>
              {totalSavings > 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute top-3 right-3 z-40"
                >
                  <div className="px-4 py-2 bg-green-500 rounded-full shadow-2xl">
                    <span className="text-lg font-black text-white tabular-nums">
                      ${totalSavings.toFixed(2)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top-left: undo */}
            <AnimatePresence>
              {discardedCoupons.length > 0 && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleRecoverLast}
                  aria-label="Undo last skip"
                  className="absolute top-3 left-3 z-40 w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center justify-center"
                >
                  <RotateCcw className="w-5 h-5 text-white" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Hint — first card ever only */}
            {showHint && deck.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
              >
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-6 text-white/80"
                >
                  <span className="text-sm font-medium">← Skip</span>
                  <div className="w-12 h-1 bg-white/30 rounded-full" />
                  <span className="text-sm font-medium">Save →</span>
                </motion.div>
              </motion.div>
            )}

            {/* Card counter */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <span className="text-xs font-medium text-white/50 tabular-nums">
                {deck.length} {deck.length === 1 ? "deal" : "deals"} left
                {walletFull ? " · wallet full" : ""}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ===== ACTION BUTTONS — visible, tappable, keyboard-equivalent ===== */}
      {deck.length > 0 && !isLoading && (
        <div className="flex items-center justify-center gap-5">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => handleSwipe("left", "button")}
            aria-label="Skip this offer"
            className="w-14 h-14 rounded-full bg-white shadow-lg border border-black/5 flex items-center justify-center"
          >
            <X className="w-7 h-7 text-red-500" strokeWidth={2.5} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => topCoupon && setDetailCoupon(topCoupon)}
            aria-label="View offer details"
            className="w-11 h-11 rounded-full bg-white shadow-md border border-black/5 flex items-center justify-center"
          >
            <Info className="w-5 h-5 text-slate-500" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => handleSwipe("right", "button")}
            aria-label="Save this offer"
            disabled={walletFull}
            className="w-14 h-14 rounded-full bg-white shadow-lg border border-black/5 flex items-center justify-center disabled:opacity-40"
          >
            <Heart className="w-7 h-7 text-green-500" strokeWidth={2.5} fill="currentColor" />
          </motion.button>
        </div>
      )}

      {/* ===== DECK COMPLETE ===== */}
      {deckExhausted && (
        <div className="rounded-3xl bg-black text-white p-8 text-center">
          <h3 className="text-xl font-bold mb-2">You're all caught up</h3>
          <p className="text-white/60 text-sm mb-6">
            You reviewed every offer. {savedCoupons.length > 0
              ? `You saved ${savedCoupons.length} worth $${totalSavings.toFixed(2)}.`
              : "Nothing saved this time."}
          </p>
          <div className="flex items-center justify-center gap-3">
            {onViewSaved && savedCoupons.length > 0 && (
              <button
                onClick={onViewSaved}
                className="px-5 py-2.5 rounded-full bg-green-500 text-white font-semibold text-sm"
              >
                View saved offers
              </button>
            )}
            <button
              onClick={handleReshuffle}
              className="px-5 py-2.5 rounded-full bg-white/10 border border-white/15 text-white font-semibold text-sm"
            >
              Review again
            </button>
          </div>
        </div>
      )}

      {/* ===== SHEETS ===== */}
      <CouponDetailSheet coupon={detailCoupon} onClose={() => setDetailCoupon(null)} />
      <DeclineReasonSheet
        coupon={declineCoupon}
        onSelect={(reason) => flushDecline(reason)}
        onDismiss={() => flushDecline(null)}
      />
    </div>
  );
};

export default CouponSwiper;
