import type { PropsWithChildren } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
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
              "w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-6 shadow-card",
              className,
            )}
          >
            {title ? <h3 className="font-display text-3xl font-semibold text-ink">{title}</h3> : null}
            <div className={cn(title && "mt-4")}>{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
