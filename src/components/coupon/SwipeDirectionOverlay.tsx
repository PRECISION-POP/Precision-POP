import React from "react";
import { motion } from "framer-motion";
import { MotionValue } from "framer-motion";

interface SwipeDirectionOverlayProps {
  bgOpacityLeft: MotionValue<number>;
  bgOpacityRight: MotionValue<number>;
  stampScaleLeft?: MotionValue<number>;
  stampScaleRight?: MotionValue<number>;
  isPersonalized?: boolean;
  isAiGenerated?: boolean;
}

const SwipeDirectionOverlay = ({ 
  bgOpacityLeft, 
  bgOpacityRight, 
  stampScaleLeft,
  stampScaleRight,
  isPersonalized,
  isAiGenerated
}: SwipeDirectionOverlayProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* BUMBLE-STYLE: Subtle edge glow instead of full overlay */}
      
      {/* Left edge glow (skip) */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-32"
        style={{ 
          opacity: bgOpacityLeft,
          background: 'linear-gradient(to right, rgba(239, 68, 68, 0.6), transparent)',
        }}
      />
      
      {/* Left "NOPE" stamp — fades in AND grows with drag commitment */}
      <motion.div
        className="absolute top-1/3 left-8 -rotate-12"
        style={{ opacity: bgOpacityLeft, scale: stampScaleLeft ?? 1 }}
      >
        <span className="text-5xl font-black text-red-500 
                         border-4 border-red-500 px-4 py-2 rounded-lg
                         tracking-wide">
          NOPE
        </span>
      </motion.div>
      
      {/* Right edge glow (save) */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-32"
        style={{ 
          opacity: bgOpacityRight,
          background: 'linear-gradient(to left, rgba(34, 197, 94, 0.6), transparent)',
        }}
      />
      
      {/* Right "SAVE" stamp — fades in AND grows with drag commitment */}
      <motion.div
        className="absolute top-1/3 right-8 rotate-12"
        style={{ opacity: bgOpacityRight, scale: stampScaleRight ?? 1 }}
      >
        <span className="text-5xl font-black text-green-500 
                         border-4 border-green-500 px-4 py-2 rounded-lg
                         tracking-wide">
          SAVE
        </span>
      </motion.div>

      {/* Personalized badge - subtle, top corner */}
      {isPersonalized && (
        <div className="absolute top-[calc(env(safe-area-inset-top,1rem)+4rem)] left-4 z-20">
          <div className="px-3 py-1.5 rounded-full text-xs font-bold 
                          bg-gradient-to-r from-yellow-400 to-orange-400
                          text-black shadow-lg">
            {isAiGenerated ? '✨ AI Pick' : '✨ For You'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SwipeDirectionOverlay;
