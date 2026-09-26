"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// `handleOnly` restricts vaul's swipe-to-dismiss gesture to the small grip
// handle at the top of the sheet instead of the entire sheet body. Without
// it, vaul treats any touch-drag anywhere in the content as a potential
// close gesture - which competes with tapping buttons/chips and with
// scrolling a long form, and on a real touchscreen a tap that has even a
// pixel of incidental vertical movement can get swallowed as a drag-start
// instead of registering as a click. That's what made controls inside
// "More options" feel unresponsive. `autoFocus={false}` stops vaul from
// focusing (and popping the keyboard for) the first focusable field the
// instant a sheet opens - jarring on mobile, especially while the sheet is
// still animating in; a component that wants a field focused does so
// itself, deliberately, once it's ready (see AmountInput usage).
const Drawer = ({
  shouldScaleBackground = true,
  handleOnly = true,
  autoFocus = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} handleOnly={handleOnly} autoFocus={autoFocus} {...props} />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-[1200] bg-black/40", className)} {...props} />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { showClose?: boolean }
>(({ className, children, showClose = true, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "safe-bottom fixed inset-x-0 bottom-0 z-[1200] mx-auto flex h-[94dvh] sm:h-auto max-h-[96dvh] w-full max-w-lg sm:max-w-xl flex-col rounded-t-sheet border-t border-border bg-card outline-none",
        className
      )}
      {...props}
    >
      {/* The grip handle is the only draggable-to-dismiss area (see `handleOnly`
          on Drawer above) - swipe down from here still closes the sheet. Must
          be vaul's own `Handle` primitive, not a plain div: `handleOnly` only
          recognizes drags that start on it. */}
      <DrawerPrimitive.Handle className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" />
      {/* An explicit, discoverable close control - swipe-to-dismiss alone isn't
          a reliable or obvious way to close a sheet, especially for anyone who
          doesn't already know the gesture. */}
      {showClose && (
        <DrawerPrimitive.Close
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </DrawerPrimitive.Close>
      )}
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 px-5 pb-2 pt-4 text-left", className)} {...props} />
);

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 px-5 pb-6 pt-2", className)} {...props} />
);

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
