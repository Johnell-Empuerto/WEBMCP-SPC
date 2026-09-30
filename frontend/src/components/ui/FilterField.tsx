import {
  cloneElement,
  forwardRef,
  isValidElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
} from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FilterFieldProps extends HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon
}

type FilterControlProps = {
  type?: string
  className?: string
  style?: CSSProperties
}

// Mirrors the Date/Month control (`MonthField`) styling: the value stays on the
// left, the given icon sits right-aligned and vertically centered with the same
// spacing (`paddingRight: 2.5rem`, `right-3`). Selects get `appearance-none` so
// only the supplied icon is visible (the native dropdown/options stay intact and
// never receive icons). The icon is `pointer-events-none` so typing/clicking and
// the native keyboard behavior are untouched. Functionality is never changed.
const FilterField = forwardRef<HTMLDivElement, FilterFieldProps>(
  function FilterField(
    { icon: Icon, className, children, ...props },
    ref
  ) {
    const child = isValidElement<FilterControlProps>(children)
      ? (children as ReactElement<FilterControlProps>)
      : null

    const isSelect = child?.type === "select"

    const injectedProps = (() => {
      if (!child) return {}
      const style = { ...child.props.style, paddingRight: "2.5rem" }
      if (isSelect) {
        return {
          className: cn("relative appearance-none cursor-pointer", child.props.className),
          style,
        }
      }
      // Non-select children (native `<input>` or shadcn `Input`, which forwards
      // ref/className/style to the native input) just get the right padding so
      // the value never runs under the icon.
      return { className: cn("relative", child.props.className), style }
    })()

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        {child ? cloneElement(child, injectedProps) : children}
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
        />
      </div>
    )
  }
)
FilterField.displayName = "FilterField"

export { FilterField }
