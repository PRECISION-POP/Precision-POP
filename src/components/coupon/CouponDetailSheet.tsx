import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Tag, Store } from "lucide-react";
import { Coupon } from "./types";

interface CouponDetailSheetProps {
  coupon: Coupon | null;
  onClose: () => void;
}

export const CouponDetailSheet = ({ coupon, onClose }: CouponDetailSheetProps) => {
  if (!coupon) return null;

  const displayValue =
    coupon.value >= 1 ? `$${coupon.value.toFixed(2)}` : `${Math.round(coupon.value * 100)}¢`;

  let expiresLabel = "No expiration shown";
  try {
    const d = new Date(coupon.expiresAt);
    if (!isNaN(d.getTime())) {
      expiresLabel = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch {
    /* keep default */
  }

  return (
    <Dialog open={!!coupon} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <div className="relative h-56 w-full bg-black">
          <img
            src={coupon.image}
            alt={coupon.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 45%, transparent 75%)",
            }}
          />
          <div className="absolute bottom-3 left-5">
            <span className="text-4xl font-black text-white">{displayValue}</span>
            <span className="text-lg font-bold text-white/80 uppercase ml-2">off</span>
          </div>
        </div>

        <DialogHeader className="px-6 pt-5 pb-2 text-left">
          <DialogTitle className="text-lg font-bold leading-snug">
            {coupon.description || coupon.title}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            {coupon.category && <Badge variant="secondary">{coupon.category}</Badge>}
            {coupon.brand && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Store className="w-3 h-3" /> {coupon.brand}
              </Badge>
            )}
            {coupon.isPersonalized && <Badge className="bg-yellow-400 text-black">✨ For You</Badge>}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="w-4 h-4" />
            <span>Offer value: <strong className="text-foreground">{displayValue}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="w-4 h-4" />
            <span>Expires: <strong className="text-foreground">{expiresLabel}</strong></span>
          </div>

          {coupon.reason && (
            <p className="text-sm text-muted-foreground border-l-2 border-yellow-400 pl-3">
              {coupon.reason}
            </p>
          )}

          <p className="text-xs text-muted-foreground pt-2">
            Present this offer at checkout with your loyalty ID to redeem. One coupon per item; cannot be combined with other offers on the same product.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
