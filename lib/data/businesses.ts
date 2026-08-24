import type { Business } from "@/lib/types/business"
import {
  normaliseBusiness,
  type NormaliseBusinessInput,
} from "@/lib/business/normalise-business"

// The single source of truth for curated demo businesses. Authored in a
// convenient shape and normalised into the shared Business model at load time.
// The Supabase setup route seeds from this same list, so the two never drift.
const CURATED: NormaliseBusinessInput[] = [
  {
    id: "1",
    name: "The Ivy Chelsea Garden",
    category: "food",
    rating: 4.8,
    reviewCount: 2340,
    location: "Chelsea, London",
    city: "London",
    description:
      "Elegant all-day dining in a stunning garden setting with British classics and seasonal dishes.",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop", source: "instagram", caption: "Garden dining at its finest", featured: true },
      { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop", source: "instagram", caption: "Recent post" },
      { url: "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&h=600&fit=crop", source: "google" },
      { url: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&h=600&fit=crop", source: "instagram", featured: true },
      { url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=600&fit=crop", source: "google", caption: "Recent post" },
    ],
    coordinates: { lat: 51.4875, lng: -0.1687 },
    priceLevel: "£££",
    tags: ["British", "Garden", "Brunch"],
    ratings: {
      instagram: { followers: 125000, trending: true },
      google: { rating: 4.6, reviews: 2340 },
      foodHygiene: 5,
    },
  },
  {
    id: "2",
    name: "Barry's Bootcamp",
    category: "fitness",
    rating: 4.9,
    reviewCount: 1856,
    location: "Soho, London",
    city: "London",
    description:
      "High-intensity interval training combining running and strength training in a red-lit studio.",
    image:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop", source: "instagram", caption: "Red room vibes", featured: true },
      { url: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&h=600&fit=crop", source: "google" },
      { url: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&h=600&fit=crop", source: "instagram", featured: true },
    ],
    coordinates: { lat: 51.5134, lng: -0.1365 },
    priceLevel: "££",
    tags: ["HIIT", "Classes", "Premium"],
    ratings: {
      instagram: { followers: 89000, trending: true },
      google: { rating: 4.8, reviews: 1856 },
    },
  },
  {
    id: "3",
    name: "Hershesons",
    category: "beauty",
    rating: 4.7,
    reviewCount: 1243,
    location: "Fitzrovia, London",
    city: "London",
    description:
      "Award-winning hair salon known for effortless, modern cuts and expert colour work.",
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=600&fit=crop", source: "instagram", caption: "Fresh cuts daily", featured: true },
      { url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&h=600&fit=crop", source: "google" },
    ],
    coordinates: { lat: 51.5194, lng: -0.1387 },
    priceLevel: "£££",
    tags: ["Hair", "Styling", "Colour"],
    ratings: {
      instagram: { followers: 67000, trending: false },
      google: { rating: 4.5, reviews: 1243 },
    },
  },
  {
    id: "4",
    name: "Grind Coffee",
    category: "cafes",
    rating: 4.6,
    reviewCount: 987,
    location: "Shoreditch, London",
    city: "London",
    description:
      "Specialty coffee roasters serving exceptional flat whites in a stylish industrial space.",
    image:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop", source: "instagram", caption: "Morning vibes", featured: true },
      { url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop", source: "google" },
      { url: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&h=600&fit=crop", source: "instagram", featured: true },
    ],
    coordinates: { lat: 51.5255, lng: -0.0839 },
    priceLevel: "£",
    // "Instagrammable" removed: Instagram is not integrated, so the label
    // implied a validation we cannot make. "Design-led" is supportable from
    // this venue's own description ("stylish industrial space").
    tags: ["Coffee", "Brunch", "Design-led"],
    ratings: {
      instagram: { followers: 156000, trending: true },
      google: { rating: 4.4, reviews: 987 },
      foodHygiene: 5,
    },
  },
  {
    id: "5",
    name: "Chiltern Firehouse",
    category: "food",
    rating: 4.9,
    reviewCount: 3210,
    location: "Marylebone, London",
    city: "London",
    description:
      "Celebrity hotspot in a converted fire station serving American-inspired cuisine.",
    image:
      "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&h=600&fit=crop", source: "instagram", caption: "Celebrity hotspot", featured: true },
      { url: "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop", source: "google" },
      { url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop", source: "instagram", featured: true },
      { url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=600&fit=crop", source: "google", caption: "Recent post" },
    ],
    coordinates: { lat: 51.5228, lng: -0.1534 },
    priceLevel: "££££",
    tags: ["American", "Celebrity", "Fine Dining"],
    ratings: {
      instagram: { followers: 234000, trending: true },
      google: { rating: 4.7, reviews: 3210 },
      foodHygiene: 5,
      bookingCom: 9.2,
    },
  },
  {
    id: "6",
    name: "Third Space",
    category: "fitness",
    rating: 4.8,
    reviewCount: 1567,
    location: "Tower Bridge, London",
    city: "London",
    description:
      "Luxury fitness club with world-class facilities, pools, and expert personal trainers.",
    image:
      "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&h=600&fit=crop", source: "instagram", caption: "Luxury fitness", featured: true },
      { url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&h=600&fit=crop", source: "google" },
    ],
    coordinates: { lat: 51.5055, lng: -0.0754 },
    priceLevel: "££££",
    tags: ["Gym", "Spa", "Pool"],
    ratings: {
      instagram: { followers: 45000, trending: false },
      google: { rating: 4.6, reviews: 1567 },
    },
  },
  {
    id: "7",
    name: "Nails & Brows Mayfair",
    category: "beauty",
    rating: 4.9,
    reviewCount: 876,
    location: "Mayfair, London",
    city: "London",
    description:
      "Luxury nail salon and brow bar favoured by influencers and celebrities alike.",
    image:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&h=600&fit=crop", source: "instagram", caption: "Nail art perfection", featured: true },
      { url: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=600&fit=crop", source: "google" },
      { url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=600&fit=crop", source: "instagram", featured: true },
    ],
    coordinates: { lat: 51.5107, lng: -0.146 },
    priceLevel: "£££",
    tags: ["Nails", "Brows", "Luxury"],
    ratings: {
      instagram: { followers: 98000, trending: true },
      google: { rating: 4.8, reviews: 876 },
    },
  },
  {
    id: "8",
    name: "Kaffeine",
    category: "cafes",
    rating: 4.7,
    reviewCount: 1123,
    location: "Fitzrovia, London",
    city: "London",
    description:
      "Australian-style cafe serving some of London's best coffee and brunch dishes.",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop", source: "instagram", caption: "Best flat white", featured: true },
      { url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&h=600&fit=crop", source: "google" },
    ],
    coordinates: { lat: 51.5185, lng: -0.1411 },
    priceLevel: "££",
    tags: ["Coffee", "Australian", "Brunch"],
    ratings: {
      instagram: { followers: 32000, trending: false },
      google: { rating: 4.5, reviews: 1123 },
      foodHygiene: 4,
    },
  },
  {
    id: "9",
    name: "Sketch",
    category: "nightlife",
    rating: 4.8,
    reviewCount: 2876,
    location: "Mayfair, London",
    city: "London",
    description:
      "Iconic venue with multiple themed rooms, from afternoon tea to late-night cocktails.",
    image:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop", source: "instagram", caption: "Iconic pink room", featured: true },
      { url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1527761939622-933f39ebaa49?w=800&h=600&fit=crop", source: "google" },
      { url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&h=600&fit=crop", source: "instagram", featured: true },
      { url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=600&fit=crop", source: "google", caption: "Recent post" },
    ],
    coordinates: { lat: 51.5127, lng: -0.1419 },
    priceLevel: "££££",
    // "Instagrammable" removed for the same reason. "Design-led" is supported
    // by this venue's existing "Art" tag and its themed-rooms description.
    tags: ["Cocktails", "Art", "Design-led"],
    ratings: {
      instagram: { followers: 412000, trending: true },
      google: { rating: 4.5, reviews: 2876 },
      foodHygiene: 5,
    },
  },
  {
    id: "10",
    name: "The Ned",
    category: "wellness",
    rating: 4.7,
    reviewCount: 1654,
    location: "City of London",
    city: "London",
    description:
      "Members club and hotel with a stunning rooftop pool and comprehensive spa facilities.",
    image:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop", source: "instagram", caption: "Rooftop views", featured: true },
      { url: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1540555700478-4be289fbec17?w=800&h=600&fit=crop", source: "google" },
      { url: "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&h=600&fit=crop", source: "instagram", featured: true },
    ],
    coordinates: { lat: 51.5131, lng: -0.0876 },
    priceLevel: "££££",
    tags: ["Spa", "Pool", "Luxury"],
    ratings: {
      instagram: { followers: 187000, trending: true },
      google: { rating: 4.4, reviews: 1654 },
      bookingCom: 8.9,
    },
  },
  {
    id: "11",
    name: "Dishoom",
    category: "food",
    rating: 4.9,
    reviewCount: 4521,
    location: "Covent Garden, London",
    city: "London",
    description:
      "Bombay-style cafe serving legendary bacon naan rolls and authentic Indian fare.",
    image:
      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop", source: "instagram", caption: "Bombay cafe vibes", featured: true },
      { url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop", source: "google" },
      { url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop", source: "instagram", featured: true },
      { url: "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&h=600&fit=crop", source: "google", caption: "Recent post" },
    ],
    coordinates: { lat: 51.5129, lng: -0.1243 },
    priceLevel: "££",
    tags: ["Indian", "Brunch", "Queue-worthy"],
    ratings: {
      instagram: { followers: 298000, trending: true },
      google: { rating: 4.7, reviews: 4521 },
      foodHygiene: 5,
    },
  },
  {
    id: "12",
    name: "Equinox",
    category: "fitness",
    rating: 4.6,
    reviewCount: 987,
    location: "Kensington, London",
    city: "London",
    description:
      "Premium fitness club with cutting-edge equipment and exclusive group classes.",
    image:
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&h=600&fit=crop",
    ],
    gallery: [
      { url: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop", source: "instagram", caption: "Premium fitness", featured: true },
      { url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop", source: "google", caption: "Popular photo" },
      { url: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&h=600&fit=crop", source: "instagram" },
      { url: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&h=600&fit=crop", source: "google" },
    ],
    coordinates: { lat: 51.5014, lng: -0.1919 },
    priceLevel: "££££",
    tags: ["Gym", "Classes", "Luxury"],
    ratings: {
      instagram: { followers: 52000, trending: false },
      google: { rating: 4.4, reviews: 987 },
    },
  },
]

export const businesses: Business[] = CURATED.map((b) =>
  normaliseBusiness(b, "curated"),
)

export const categories = [
  { id: "all", name: "All", icon: "Sparkles" },
  { id: "food", name: "Food", icon: "UtensilsCrossed" },
  { id: "fitness", name: "Fitness", icon: "Dumbbell" },
  { id: "beauty", name: "Beauty", icon: "Sparkles" },
  { id: "cafes", name: "Cafes", icon: "Coffee" },
  { id: "nightlife", name: "Nightlife", icon: "Wine" },
  { id: "wellness", name: "Wellness", icon: "Heart" },
] as const
