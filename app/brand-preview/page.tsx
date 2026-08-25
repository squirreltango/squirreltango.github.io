import { LookMeUpMark } from "@/components/brand/look-me-up-mark"
import { LookMeUpLogo } from "@/components/brand/look-me-up-logo"

// TEMPORARY verification page - deleted after review.
export default function BrandPreview() {
  return (
    <main className="min-h-screen bg-background p-10 flex flex-col gap-10">
      <div className="flex items-end gap-8 text-foreground">
        <LookMeUpMark className="h-4 w-4 text-foreground" />
        <LookMeUpMark className="h-8 w-8 text-foreground" />
        <LookMeUpMark className="h-12 w-12 text-foreground" />
        <LookMeUpMark className="h-20 w-20 text-foreground" />
        <LookMeUpMark className="h-20 w-20 text-foreground" withTile={false} />
      </div>
      <div className="flex flex-col gap-4">
        <LookMeUpLogo className="font-serif font-semibold text-2xl tracking-tight text-foreground" />
        <LookMeUpLogo className="font-serif font-semibold text-xl tracking-tight text-foreground" />
        <LookMeUpLogo className="font-serif font-semibold text-5xl tracking-tight text-foreground" />
      </div>
    </main>
  )
}
