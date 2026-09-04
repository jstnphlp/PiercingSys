"use client";

import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { operationDialog } from "./dashboard-styles";

export function SideDrawer({
  title,
  detail,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  detail?: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || !busy) setOpen(nextOpen);
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      disablePointerDismissal={busy}
    >
      <DialogContent
        className={`${operationDialog} gap-0 p-0 ring-0`}
        showCloseButton={false}
      >
        <header>
          <div className="min-w-0">
            <DialogTitle>{title}</DialogTitle>
            {detail && <DialogDescription>{detail}</DialogDescription>}
          </div>
          <DialogClose aria-label={`Close ${title}`} disabled={busy}>
            <X />
          </DialogClose>
        </header>
        {typeof children === "function" ? children(close) : children}
      </DialogContent>
    </Dialog>
  );
}
