import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-900 text-center px-4">
      <p className="text-5xl font-semibold text-slate-900 dark:text-slate-100">404</p>
      <p className="text-slate-500 dark:text-slate-400">This page doesn't exist.</p>
      <Link to="/">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  );
}
