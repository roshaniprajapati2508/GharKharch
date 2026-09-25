"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface BrandLoaderMarkProps {
  size?: number; // Total diameter in px (default 84)
  isSuccess?: boolean;
  className?: string;
}

/**
 * GharKharch Brand Loader Mark:
 * Original CRM favicon in the centre + animated circular progress/ring around it.
 * Strictly adheres to GharKharch brand palette (#087f6e, #22c55e, #fcd34d).
 */
export function BrandLoaderMark({
  size = 84,
  isSuccess = false,
  className = "",
}: BrandLoaderMarkProps) {
  // Proportional sizing
  const strokeWidth = Math.max(3, Math.round(size * 0.045));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // Dash covering roughly 65% of circumference for a luxury spinner arc
  const arcLength = circumference * 0.65;
  const iconSize = Math.round(size * 0.52);

  const gradientId = `gk-loader-grad-${size}`;
  const successGradId = `gk-success-grad-${size}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={isSuccess ? "Operation completed" : "Loading"}
    >
      {/* Ambient background glow */}
      <div
        className={`absolute inset-1 rounded-full blur-md transition-opacity duration-500 pointer-events-none ${
          isSuccess
            ? "bg-brand-green/30 opacity-80"
            : "bg-brand-primary/20 brand-loader-glow"
        }`}
      />

      {/* Outer SVG progress / spinner ring */}
      <svg
        className={`absolute inset-0 transition-transform duration-500 ${
          isSuccess ? "rotate-0" : "brand-loader-spin"
        }`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#087f6e" />
            <stop offset="60%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#fcd34d" />
          </linearGradient>
          <linearGradient id={successGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#087f6e" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>

        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-brand-primary/15 dark:text-brand-primary/25"
        />

        {/* Active animated / success ring */}
        {isSuccess ? (
          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${successGradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeLinecap="round"
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Inner Circular Well housing the CRM Icon */}
      <div
        className="relative z-10 flex items-center justify-center rounded-full bg-surface dark:bg-[#0c1412] shadow-sm border border-border/40 overflow-hidden"
        style={{
          width: iconSize + strokeWidth * 2.5,
          height: iconSize + strokeWidth * 2.5,
        }}
      >
        <Image
          src="/icons/icon-192.png"
          alt="GharKharch Icon"
          width={iconSize}
          height={iconSize}
          className={`object-contain transition-transform duration-300 ${
            isSuccess ? "scale-90 opacity-40 blur-[0.5px]" : "scale-100 opacity-100"
          }`}
          priority
        />

        {/* Success checkmark pop overlay */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 450, damping: 22 }}
              className="absolute inset-0 flex items-center justify-center bg-brand-green/20 backdrop-blur-[1px]"
            >
              <div className="flex items-center justify-center rounded-full bg-brand-primary text-white p-1 shadow-md">
                <Check
                  className="stroke-[3]"
                  style={{
                    width: Math.max(14, Math.round(iconSize * 0.45)),
                    height: Math.max(14, Math.round(iconSize * 0.45)),
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
