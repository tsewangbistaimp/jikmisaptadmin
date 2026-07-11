import * as React from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  destructive?: boolean;
}

/**
 * Shared small icon-only button used across list/table row actions (view,
 * edit, delete, etc). Consolidated from three near-identical copies that
 * used to live in Bookings.tsx, Rooms.tsx, and settings/Users.tsx — this is
 * the one place to change hover/focus/press behavior for all of them.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ title, destructive, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        title={title}
        aria-label={title}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg transition-[background-color,transform] duration-150 ease-out active:scale-90 md:h-8 md:w-8",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
          destructive
            ? "text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";
