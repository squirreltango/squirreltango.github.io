// TEMPORARY verification page - deleted once the scheme-aware UI is confirmed.
import type { Business, FoodHygieneRating } from "@/lib/types/business"
import { HygieneBadgeCompact, HygieneBadgePill, HygieneBadgeDetail } from "@/components/hygiene-badge"

function stub(rating: Partial<FoodHygieneRating> | null, name: string): Business {
  return {
    name,
    providerRatings: rating
      ? {
          foodHygieneRating: {
            fhrsId: 123456,
            businessName: name,
            ratingValue: "5",
            matchConfidence: "exact",
            localAuthority: "Hackney",
            ratingDate: "2024-06-11",
            ...rating,
          },
        }
      : {},
  } as unknown as Business
}

const CASES: { label: string; business: Business }[] = [
  { label: 'FHRS "5"', business: stub({ ratingValue: "5" }, "Very good venue") },
  { label: 'FHRS "4"', business: stub({ ratingValue: "4" }, "Good venue") },
  { label: 'FHRS "3"', business: stub({ ratingValue: "3" }, "Satisfactory venue") },
  { label: 'FHRS "1"', business: stub({ ratingValue: "1" }, "Poor venue") },
  { label: 'FHRS "0"', business: stub({ ratingValue: "0" }, "Urgent venue") },
  { label: 'FHIS "Pass" (Scotland)', business: stub({ ratingValue: "Pass", localAuthority: "Edinburgh" }, "Scottish venue") },
  {
    label: 'FHIS "Improvement Required"',
    business: stub({ ratingValue: "Improvement Required", localAuthority: "Glasgow" }, "Scottish poor"),
  },
  { label: '"AwaitingInspection"', business: stub({ ratingValue: "AwaitingInspection" }, "New venue") },
  { label: '"Exempt"', business: stub({ ratingValue: "Exempt" }, "Exempt venue") },
  { label: "Unrecognised value", business: stub({ ratingValue: "SomeFutureScheme" }, "Unknown venue") },
  { label: "No rating at all", business: stub(null, "Unmatched venue") },
  {
    label: 'High-confidence + pending (shows "Matched to")',
    business: stub(
      { ratingValue: "4", matchConfidence: "high", newRatingPending: true, postcode: "E1 4UT", businessName: "Dishoom Shoreditch" },
      "High confidence venue",
    ),
  },
]

export default function HygienePreview() {
  return (
    <main className="min-h-screen bg-background p-8">
      <h1 className="font-serif text-2xl text-foreground mb-6">Hygiene badge - scheme matrix</h1>
      <div className="flex flex-col gap-4">
        {CASES.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/50 p-4">
            <p className="text-xs font-mono text-muted-foreground mb-3">{c.label}</p>
            <div className="flex flex-wrap items-start gap-6">
              <div className="w-56">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">compact</p>
                <HygieneBadgeCompact business={c.business} />
              </div>
              <div className="w-40">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">pill</p>
                <HygieneBadgePill business={c.business} />
              </div>
              <div className="w-72">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">detail</p>
                <HygieneBadgeDetail business={c.business} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
