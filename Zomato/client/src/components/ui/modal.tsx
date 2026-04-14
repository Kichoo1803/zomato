import type { PropsWithChildren } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./button";
import { cn } from "@/utils/cn";

type ModalProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
}>;

export const Modal = ({ open, onClose, title, className, children }: ModalProps) => {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-x-hidden overflow-y-auto bg-ink/30 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-card",
              className,
            )}
          >
            <Button
              type="button"
              variant="ghost"
              className="absolute right-4 top-4 h-10 w-10 p-0"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </Button>
            {title ? <h3 className="pr-12 font-display text-3xl font-semibold text-ink">{title}</h3> : null}
            <div className={cn(title && "mt-4")}>{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
