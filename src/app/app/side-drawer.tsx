"use client";

import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || !busy) setOpen(nextOpen);
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      disablePointerDismissal={busy}
    >
      <SheetContent>
        <SheetHeader>
          <div className="min-w-0">
            <SheetTitle>{title}</SheetTitle>
            {detail && <SheetDescription>{detail}</SheetDescription>}
          </div>
          <SheetClose aria-label={`Close ${title}`} disabled={busy}>
            <X />
          </SheetClose>
        </SheetHeader>
        <SheetBody>
          {typeof children === "function" ? children(close) : children}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
