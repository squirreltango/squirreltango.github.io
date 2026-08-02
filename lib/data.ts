// Backwards-compatible barrel. The authoritative model lives in
// `lib/types/business.ts` and the single curated dataset in
// `lib/data/businesses.ts`.
export type {
  Business,
  BusinessSource,
  CategoryId,
  GalleryImage,
  BusinessReview,
  OpeningHours,
} from "@/lib/types/business"

export { businesses, categories } from "@/lib/data/businesses"
