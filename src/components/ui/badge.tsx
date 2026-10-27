import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-semibold font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 glow-border-primary": variant === "default",
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 glow-border-destructive": variant === "destructive",
          "text-foreground border-border": variant === "outline",
          "border-transparent bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:opacity-80 glow-border-success": variant === "success",
          "border-transparent bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:opacity-80 glow-border-warning": variant === "warning",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
