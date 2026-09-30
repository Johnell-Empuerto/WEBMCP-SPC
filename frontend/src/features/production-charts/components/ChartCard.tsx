import type { ComponentType, ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  subtitle?: string
  icon?: ComponentType<{ className?: string }>
  className?: string
  action?: ReactNode
  children: ReactNode
}

export default function ChartCard({
  title,
  subtitle,
  icon: Icon,
  className,
  action,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn("rounded-2xl border-border/60 shadow-sm overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-5 pt-5 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-foreground truncate">{title}</span>
            {subtitle && (
              <span className="block text-[11px] font-normal text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </span>
            )}
          </div>
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  )
}
