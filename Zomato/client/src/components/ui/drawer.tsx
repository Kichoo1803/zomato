import type { PropsWithChildren } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./button";
import { cn } from "@/utils/cn";

type DrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
}>;

export const Drawer = ({ open, onClose, title, className, children }: DrawerProps) => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-white/70 bg-white p-6 shadow-card",
              className,
            )}
          >
            <Button
              type="button"
              variant="ghost"
              className="absolute right-4 top-4 h-10 w-10 p-0"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </Button>
            {title ? <h3 className="pr-12 font-display text-3xl font-semibold text-ink">{title}</h3> : null}
            <div className={cn(title && "mt-4")}>{children}</div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
