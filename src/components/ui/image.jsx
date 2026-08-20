import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Plain <img> with a graceful failure mode.
 *
 * Images come from two places now: whatever URL a shop's og:image points at,
 * and Supabase Storage public URLs. Neither offers server-side resizing on the
 * free tier, so there is no transform layer here — just native lazy loading and
 * a fallback for links that rot.
 *
 * `fittingType="fit"` letterboxes (object-contain); "fill" crops (object-cover).
 */
const Image = React.forwardRef(({ src, fittingType = "fill", className, onError, ...props }, ref) => {
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    setFailed(false)
  }, [src])

  const handleError = (event) => {
    setFailed(true)
    onError?.(event)
  }

  if (!src || failed) {
    return (
      <span
        ref={ref}
        className={cn("flex items-center justify-center bg-muted text-muted-foreground/40", className)}
        aria-hidden="true"
        data-empty-image
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 6h.008v.008H18V6zm2.25 12H3.75A1.5 1.5 0 012.25 16.5v-9A1.5 1.5 0 013.75 6h16.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5z"
          />
        </svg>
      </span>
    )
  }

  return (
    <img
      ref={ref}
      src={src}
      loading="lazy"
      decoding="async"
      className={cn(fittingType === "fit" ? "object-contain" : "object-cover", className)}
      onError={handleError}
      {...props}
    />
  )
})
Image.displayName = "Image"

export { Image }
