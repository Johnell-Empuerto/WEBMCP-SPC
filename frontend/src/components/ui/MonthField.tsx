import {
  cloneElement,
  forwardRef,
  isValidElement,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type Ref,
} from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MonthFieldProps extends HTMLAttributes<HTMLDivElement> {}

type MonthControlProps = {
  type?: string
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLInputElement | HTMLSelectElement>
}

// For a native `input[type="month"]` / `input[type="date"]` the transparent
// `::-webkit-calendar-picker-indicator` is stretched across the whole field so
// clicking anywhere opens the native picker (WebKit/Blink). `appearance: none`
// must never be applied here — in Chromium/WebKit it removes the picker
// indicator control and disables click-to-open. A plain `<select>` gets
// `appearance-none` (hides the native arrow, never disables the native
// dropdown). `cursor-pointer` is applied directly to the control element so
// hover instantly reads as clickable.
const PICKER_INDICATOR_CLASSES = [
  "[&::-webkit-calendar-picker-indicator]:absolute",
  "[&::-webkit-calendar-picker-indicator]:inset-y-0",
  "[&::-webkit-calendar-picker-indicator]:left-0",
  "[&::-webkit-calendar-picker-indicator]:w-full",
  "[&::-webkit-calendar-picker-indicator]:opacity-0",
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
] as const

const CalendarField = forwardRef<HTMLDivElement, MonthFieldProps>(
  function CalendarField({ className, children, onClick, ...props }, ref) {
    const child = isValidElement<MonthControlProps>(children)
      ? (children as ReactElement<MonthControlProps>)
      : null

    const controlRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

    const isNativePicker =
      child?.props.type === "month" || child?.props.type === "date"

    // Clicking anywhere on a month/date field must open the native picker. The
    // stretched transparent indicator covers some zones but browsers are not
    // consistent about the whole hitbox, so this fallback explicitly calls the
    // browser's own showPicker() — the SAME native picker, never a custom one.
    // It needs a user gesture (the click) and is a no-op/throws when the picker
    // is already open or the element doesn't support it, both of which we ignore.
    const handleWrapperClick = () => {
      if (!isNativePicker) return
      const el = controlRef.current
      if (el instanceof HTMLInputElement && typeof el.showPicker === "function") {
        try {
          el.showPicker()
        } catch {
          /* picker already showing, or picker unavailable — ignore */
        }
      }
    }

    // Detection uses the `type` prop (not just the element tag) so shadcn
    // components like `Input` that forward ref/className/style to the native
    // input also get the treatment.
    const injectedProps = (() => {
      if (!child) return {}
      const style = { ...child.props.style, paddingRight: "2.5rem" }
      if (child.type === "select") {
        return {
          className: cn("relative appearance-none cursor-pointer", child.props.className),
          style,
        }
      }
      if (isNativePicker) {
        return {
          className: cn(
            "relative cursor-pointer",
            ...PICKER_INDICATOR_CLASSES,
            child.props.className
          ),
          style,
          ref: controlRef,
        }
      }
      return { className: child.props.className, style }
    })()

    return (
      <div
        ref={ref}
        className={cn("relative", className)}
        onClick={isNativePicker ? handleWrapperClick : onClick}
        {...props}
      >
        {child ? cloneElement(child, injectedProps) : children}
        <CalendarDays
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
        />
      </div>
    )
  }
)
CalendarField.displayName = "CalendarField"

export { CalendarField as MonthField }
export { CalendarField as DateField }