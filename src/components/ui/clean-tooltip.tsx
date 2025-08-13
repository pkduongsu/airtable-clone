"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "~/lib/utils";

function CleanTooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function CleanTooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />
}

function CleanTooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...props} />
}

// Custom tooltip content without arrow for cleaner rectangular look
function CleanTooltipContent({
  className,
  sideOffset = 8,
  alignOffset,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className={cn(
          "bg-[#1d1f25] text-white rounded-[4px] font-family-system px-2 py-1 text-[11px] border-0 shadow-lg z-50",
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      >
        {children}
        {/* No arrow for cleaner rectangular look */}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { 
  CleanTooltip, 
  CleanTooltipTrigger, 
  CleanTooltipContent, 
  CleanTooltipProvider 
}