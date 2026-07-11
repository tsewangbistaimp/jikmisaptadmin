import * as React from "react";
import { useMotionValue, animate, motion, useReducedMotion } from "framer-motion";

/**
 * Counts up from 0 (or from its previous value, on updates) to `value`,
 * formatting each in-between frame with `format`. Used for headline stat
 * numbers (revenue, bookings, occupancy, etc.) across the dashboard and
 * expenses page. Respects prefers-reduced-motion — jumps straight to the
 * final value instead of animating when the user has that OS setting on.
 */
export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString(),
  duration = 0.8,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = React.useState(format(0));
  const hasMounted = React.useRef(false);

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(format(value));
      hasMounted.current = true;
      return;
    }
    const from = hasMounted.current ? motionValue.get() : 0;
    hasMounted.current = true;
    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        motionValue.set(v);
        setDisplay(format(v));
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <motion.span>{display}</motion.span>;
}

/**
 * Wraps children (typically a trend/percentage badge) so it fades+slides in
 * only after a short delay — used to make trend arrows appear once the
 * count-up above them has mostly finished, per the "count finishes first,
 * then trend appears" spec.
 */
export function DelayedFadeIn({ children, delay = 0.6 }: { children: React.ReactNode; delay?: number }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: prefersReducedMotion ? 0 : delay, ease: "easeOut" }}
      className="inline-block"
    >
      {children}
    </motion.span>
  );
}
