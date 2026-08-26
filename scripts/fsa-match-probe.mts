/**
 * Matcher validation probe - NOT the ingestion test.
 *
 * Calls only the public FSA API and the pure matching functions. Touches no
 * database, writes nothing, and never imports the Supabase client. Its job is
 * to prove the branch-confusion guard works against REAL data before any
 * ingestion is wired up.
 *
 * Fixtures below are taken verbatim from the live FSA API, not invented, so
 * the assertions reflect genuine chain behaviour: a name-only search for
 * "Dishoom" returns 14+ establishments whose names are byte-identical.
 *
 * Run: npx tsx scripts/fsa-match-probe.mts
 */
import { matchFsaHygiene, nameSimilarity } from "../lib/business/fsa-hygiene"
import { describeHygieneRating } from "../lib/business/hygiene-display"
import type { Business } from "../lib/types/business"

function stub(
  name: string,
  postcode: string | undefined,
  lat: number | undefined,
  lng: number | undefined,
): Business {
  return {
    id: "probe",
    name,
    category: "restaurant",
    location: {
      postcode,
      coordinates: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
    },
    media: { images: [], gallery: [] },
    rating: {},
    providerRatings: {},
    contact: {},
    reviews: [],
    flags: {},
    tags: [],
  } as unknown as Business
}

// Verbatim from the live FSA API.
const REAL = {
  kingsCross: { fhrsId: 804872, postcode: "N1C 4AB", lat: 51.536513, lng: -0.124696 },
  shoreditch: { fhrsId: 469023, postcode: "E2 7JE", lat: 51.524562, lng: -0.0768562 },
  towerHamlets: { fhrsId: 1537379, postcode: "E1 4UT", lat: 51.5203437805176, lng: -0.0511990003287792 },
  coventGarden: { fhrsId: 944336, postcode: "WC2H 9FB", lat: 51.5124433, lng: -0.1268853 },
  glasgow: { fhrsId: 1835296, postcode: "G2 1QY", lat: 55.8617573, lng: -4.2545013 },
  leeds: { fhrsId: 1883566, postcode: "LS1 7JH", lat: 53.798433, lng: -1.53954 },
}

interface Expectation {
  label: string
  business: Business
  expectStatus: string
  expectFhrsId?: number
  note?: string
}

async function main() {
  console.log("=== the chain problem, quantified ===")
  console.log(`  "Dishoom" vs "Dishoom"          -> ${nameSimilarity("Dishoom", "Dishoom").toFixed(3)}`)
  console.log(`  "Dishoom" vs "Dishoom Limited"  -> ${nameSimilarity("Dishoom", "Dishoom Limited").toFixed(3)}`)
  console.log(`  "Dishoom" vs "Dishoom Ltd"      -> ${nameSimilarity("Dishoom", "Dishoom Ltd").toFixed(3)}`)
  console.log("  => name alone cannot separate branches; postcode/distance must.")

  const cases: Expectation[] = [
    {
      label: "Kings Cross, exact postcode + coords",
      business: stub("Dishoom", REAL.kingsCross.postcode, REAL.kingsCross.lat, REAL.kingsCross.lng),
      expectStatus: "match",
      expectFhrsId: REAL.kingsCross.fhrsId,
      note: "must pick N1C 4AB out of 14 identically-named branches",
    },
    {
      label: "Shoreditch, exact postcode + coords",
      business: stub("Dishoom", REAL.shoreditch.postcode, REAL.shoreditch.lat, REAL.shoreditch.lng),
      expectStatus: "match",
      expectFhrsId: REAL.shoreditch.fhrsId,
      note: "FSA name is 'Dishoom Bombay Cafe' - subset name, postcode confirms",
    },
    {
      label: "Covent Garden, exact postcode + coords",
      business: stub("Dishoom", REAL.coventGarden.postcode, REAL.coventGarden.lat, REAL.coventGarden.lng),
      expectStatus: "match",
      expectFhrsId: REAL.coventGarden.fhrsId,
    },
    {
      label: "Tower Hamlets E1, exact postcode + coords",
      business: stub("Dishoom", REAL.towerHamlets.postcode, REAL.towerHamlets.lat, REAL.towerHamlets.lng),
      expectStatus: "match",
      expectFhrsId: REAL.towerHamlets.fhrsId,
      note: "the E1 branch that a coords-only search previously hid",
    },
    {
      label: "Glasgow (Scotland, FHIS scheme)",
      business: stub("Dishoom", REAL.glasgow.postcode, REAL.glasgow.lat, REAL.glasgow.lng),
      expectStatus: "match",
      expectFhrsId: REAL.glasgow.fhrsId,
      note: "must surface 'Pass', never a fake X/5",
    },
    {
      label: "Leeds (AwaitingInspection)",
      business: stub("Dishoom", REAL.leeds.postcode, REAL.leeds.lat, REAL.leeds.lng),
      expectStatus: "match",
      expectFhrsId: REAL.leeds.fhrsId,
      note: "must render as pending, never as 0/5",
    },
    {
      label: "CONTRADICTORY: Kings Cross coords, Shoreditch postcode",
      business: stub("Dishoom", REAL.shoreditch.postcode, REAL.kingsCross.lat, REAL.kingsCross.lng),
      // Refusal is the correct outcome, and this expectation was initially
      // written wrong. The two signals disagree by ~5km, so the source record
      // is internally inconsistent - there is no way to know which field is
      // right. Picking either branch would be a guess about food safety, so
      // "return nothing" is the only defensible answer.
      expectStatus: "below-threshold|ambiguous",
      note: "self-contradictory input must be refused, not resolved by guessing",
    },
    {
      label: "No postcode, Kings Cross coords only",
      business: stub("Dishoom", undefined, REAL.kingsCross.lat, REAL.kingsCross.lng),
      expectStatus: "match",
      expectFhrsId: REAL.kingsCross.fhrsId,
      note: "distance must isolate one branch",
    },
    {
      label: "No postcode, no coords (worst case)",
      business: stub("Dishoom", undefined, undefined, undefined),
      expectStatus: "ambiguous|below-threshold",
      note: "MUST refuse - 14 identical names, zero evidence",
    },
    {
      label: "Nonexistent venue",
      business: stub("Totally Fake Venue Xyzzy", "E1 6JJ", 51.5245, -0.0754),
      expectStatus: "no-candidates",
    },
  ]

  let pass = 0
  let fail = 0

  for (const c of cases) {
    const r = await matchFsaHygiene(c.business)
    const statusOk = c.expectStatus.split("|").includes(r.status)
    const idOk = c.expectFhrsId === undefined || r.rating?.fhrsId === c.expectFhrsId
    const ok = statusOk && idOk
    ok ? pass++ : fail++

    console.log(`\n  ${ok ? "PASS" : "FAIL"} :: ${c.label}`)
    if (c.note) console.log(`    intent: ${c.note}`)
    console.log(`    status: ${r.status} (expected ${c.expectStatus})`)
    if (r.rating) {
      const d = describeHygieneRating(r.rating)
      console.log(
        `    matched: FHRSID=${r.rating.fhrsId} "${r.rating.businessName}" ${r.rating.postcode}` +
          ` | confidence=${r.rating.matchConfidence}` +
          ` | dist=${r.rating.distanceMeters === undefined ? "n/a" : Math.round(r.rating.distanceMeters) + "m"}`,
      )
      console.log(`    display: kind=${d?.kind} label="${d?.label}"`)
      if (c.expectFhrsId !== undefined && !idOk) {
        console.log(`    !! WRONG BRANCH - expected FHRSID=${c.expectFhrsId}`)
      }
    }
    if (r.reason) console.log(`    reason: ${r.reason}`)
    if (r.diagnostics) console.log(`    diag: ${JSON.stringify(r.diagnostics)}`)
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`)
  if (fail > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error("PROBE ERROR", e)
  process.exit(1)
})
