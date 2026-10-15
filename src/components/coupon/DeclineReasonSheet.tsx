import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coupon } from "./types";

// Structured decline reasons — this is the core Precision POP data asset:
// knowing *why* a shopper rejected an offer, tied to their profile.
const DECLINE_REASONS = [
  "Don't buy this brand",
  "Not enough of a discount",
  "Already have it at home",
  "Wrong size or variant",
  "Don't like this product",
  "Not interested right now",
];

interface DeclineReasonSheetProps {
  coupon: Coupon | null;
  onSelect: (reason: string) => void;
  onDismiss: () => void;
}

export const DeclineReasonSheet = ({ coupon, onSelect, onDismiss }: DeclineReasonSheetProps) => {
  return (
    <Dialog open={!!coupon} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent
        className="sm:max-w-md rounded-t-3xl sm:rounded-3xl p-0 gap-0 overflow-hidden
                   fixed left-1/2 bottom-0 translate-x-[-50%] translate-y-0
                   sm:bottom-auto sm:translate-y-[-50%] sm:top-1/2 w-full"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-5 pb-2 text-left">
          <DialogTitle className="text-base font-bold">
            Why skip this one?
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {coupon?.description?.slice(0, 60)}
            {(coupon?.description?.length || 0) > 60 ? "…" : ""} — helps brands make better offers.
          </p>
        </DialogHeader>
        <div className="px-3 pb-3 pt-1 max-h-[50dvh] overflow-y-auto">
          {DECLINE_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => onSelect(reason)}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium
                         hover:bg-muted active:bg-muted transition-colors"
            >
              {reason}
            </button>
          ))}
          <button
            onClick={onDismiss}
            className="w-full text-center px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground
                       hover:bg-muted active:bg-muted transition-colors"
          >
            Skip without answering
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
