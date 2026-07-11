// ============================================================================
// Shared animation tokens — the single source of truth for timing, easing,
// and reusable Framer Motion variants across the whole app. Keeping these
// centralized means every component that imports from here automatically
// stays consistent (same speed/feel) instead of hand-rolled one-off values.
//
// Timing scale (ms), per the app's animation spec:
//   fast    120   — micro state changes (icon, tiny hover)
//   normal  200   — default interactive transitions (buttons, badges)
//   medium  250   — page/card entrances
//   slow    350   — larger surfaces (modals, drawers, sheets)
// ============================================================================

export const DURATION = {
  fast: 0.12,
  normal: 0.2,
  medium: 0.25,
  slow: 0.35,
} as const;

// Framer Motion transition presets
export const EASE_OUT = [0.16, 1, 0.3, 1] as const; // snappy, decisive ease-out
export const SPRING_SNAPPY = { type: "spring", stiffness: 420, damping: 32, mass: 0.7 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 300, damping: 30, mass: 0.8 } as const;

// ---------------------------------------------------------------------------
// Page transitions (AppLayout)
// ---------------------------------------------------------------------------
export const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.medium, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.fast, ease: EASE_OUT } },
};

// ---------------------------------------------------------------------------
// Card / surface entrance (fade + slide up)
// ---------------------------------------------------------------------------
export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.medium, ease: EASE_OUT } },
};

// ---------------------------------------------------------------------------
// Modal / dropdown scale-in
// ---------------------------------------------------------------------------
export const scaleFade = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: DURATION.normal, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: DURATION.fast, ease: EASE_OUT } },
};

export const backdropFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.normal } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

// ---------------------------------------------------------------------------
// Bottom sheet (mobile) — slide up + fade
// ---------------------------------------------------------------------------
export const sheetVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
  exit: { opacity: 0, y: 24, transition: { duration: DURATION.normal, ease: EASE_OUT } },
};

// ---------------------------------------------------------------------------
// Dropdown / menu panel — fade + scale + slight slide
// ---------------------------------------------------------------------------
export const dropdownVariants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.normal, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: { duration: DURATION.fast, ease: EASE_OUT } },
};

// ---------------------------------------------------------------------------
// Stagger containers — table rows, card grids, legend lists
// ---------------------------------------------------------------------------
export const staggerContainer = (staggerMs = 30) => ({
  initial: {},
  animate: { transition: { staggerChildren: staggerMs / 1000 } },
});

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.normal, ease: EASE_OUT } },
};
