"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-100 bg-[#2d181247] opacity-100 transition-opacity duration-150 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  ...props
}: SheetPrimitive.Popup.Props) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed top-3 right-3 z-100 flex h-[min(740px,calc(100vh-24px))] w-[min(430px,calc(100vw-24px))] translate-x-0 transform-gpu flex-col overflow-hidden rounded-[22px_16px_22px_18px] border-2 border-hippy-ink bg-[#fff5df] text-sm text-hippy-ink shadow-[8px_8px_0_#3b2923] outline-none will-change-transform [transition:transform_200ms_cubic-bezier(.22,1,.36,1)] data-starting-style:translate-x-[calc(100%+24px)] data-ending-style:translate-x-[calc(100%+24px)] motion-reduce:transition-none max-[700px]:top-2.5 max-[700px]:right-2.5 max-[700px]:h-[calc(100vh-20px)] max-[700px]:w-[calc(100vw-20px)] max-[700px]:rounded-[18px]",
          className
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="sheet-header"
      className={cn(
        "flex shrink-0 justify-between gap-4 border-b border-dashed border-[#c88f6e] bg-[#fff5df] px-[18px] pt-[15px] pb-[11px] [&_button]:grid [&_button]:size-[32px] [&_button]:shrink-0 [&_button]:cursor-pointer [&_button]:place-items-center [&_button]:rounded-[10px] [&_button]:border-[1.5px] [&_button]:border-hippy-ink [&_button]:bg-[#efc6a4] [&_button]:p-0 [&_button]:leading-none [&_button_svg]:block [&_button_svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto [scrollbar-color:#d5aa89_transparent] [scrollbar-width:thin]",
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "m-0 font-display text-[21px] leading-tight font-bold",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        "mt-[3px] mb-0 text-[10px] leading-[1.35] text-[#785d53]",
        className
      )}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
