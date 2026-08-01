import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 text-center dark:bg-slate-950">
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-navy-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-gold-400/10 blur-3xl" />

      <motion.div variants={fadeUp} initial="initial" animate="animate" className="relative flex flex-col items-center gap-3">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-navy-500 to-navy-700 text-white shadow-lg shadow-navy-500/30">
          <Compass className="h-8 w-8" />
        </div>
        <p className="bg-gradient-to-br from-navy-600 to-navy-400 bg-clip-text text-6xl font-semibold text-transparent dark:from-navy-300 dark:to-navy-500">
          404
        </p>
        <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Page not found</p>
        <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Link to="/" className="mt-3">
          <Button>Back to Dashboard</Button>
        </Link>
      </motion.div>
    </div>
  );
}
