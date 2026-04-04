"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 before:absolute before:-inset-3 before:content-['']",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="pointer-events-none block size-4 rounded-full bg-foreground shadow-sm transition-transform translate-x-0 data-[checked]:translate-x-4 data-[checked]:bg-primary-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
