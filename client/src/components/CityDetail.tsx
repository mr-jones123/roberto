import { useState, type JSX } from "react"
import { scoreColor, scoreLabelKey, formatPercent, formatPercentRaw, formatPHP } from "../lib/colors"
import { useLocale, type Locale } from "../lib/locale"
import type { City, Project } from "../lib/types"
import { AIAnalysis } from "./AIAnalysis"

type Props = {
  city: City
  projects: Project[]
  onClose: () => void
}

type SortKey = "progress" | "budget"
type SortDir = "asc" | "desc"

type FloodProfile = {
  mechanism: string
  river: string
  history: string
  localTip: string
}

const FLOOD_PROFILES_EN: Record<string, FloodProfile> = {
  marikina: {
    mechanism: "Marikina River overflow",
    river: "Marikina River",
    history: "During Ondoy (2009) the Marikina River exceeded 21 m, submerging riverside barangays to rooftop level. Carina (2024) swept barges into bridges here.",
    localTip: "Riverside barangays can flood within hours when upstream Rizal rainfall is heavy. Set an evacuation trigger at the 16 m river warning level - do not wait for 18 m critical.",
  },
  malabon: {
    mechanism: "tidal flooding from Manila Bay and Tullahan River overflow",
    river: "Tullahan River / Manila Bay",
    history: "Malabon experiences daily tidal flooding even without rain. During Habagat (2012), storm surge broke through sea walls at fish ports.",
    localTip: "Flooding here comes from two directions - tides and the Tullahan River - and can persist for days. Elevate electrical outlets and appliances permanently, not just before storms.",
  },
  navotas: {
    mechanism: "chronic tidal and coastal flooding from Manila Bay",
    river: "Manila Bay coastline",
    history: "Navotas floods daily from high tides. In June 2024, a damaged floodgate at the Malabon-Navotas boundary caused persistent flooding affecting ~2,000 residents.",
    localTip: "Tides dictate daily life here. Track the PAGASA tide schedule and keep sandbags and waterproof containers ready at all times - not just during typhoon season.",
  },
  valenzuela: {
    mechanism: "Tullahan River overflow and drainage failure",
    river: "Tullahan River",
    history: "Valenzuela was severely hit during Ondoy (2009) and Carina (2024). La Mesa Dam releases amplify Tullahan River flooding downstream.",
    localTip: "When La Mesa Dam releases water, Tullahan River levels can spike fast. If you hear about dam releases, begin evacuating low-lying areas immediately.",
  },
  caloocan: {
    mechanism: "Tullahan River overflow and poor drainage",
    river: "Tullahan River",
    history: "South Caloocan and the Fairview-Novaliches border are chronic flood zones. During Habagat (2012), the Tullahan flooded the Atherton Bridge area and swept away riverside homes.",
    localTip: "South Caloocan (low-lying, dense) floods from the Tullahan. North Caloocan (Fairview) floods when La Mesa Dam overflows. Know which type affects your barangay.",
  },
  quezon: {
    mechanism: "multiple - Tullahan River in the north, San Juan River in the south, and drainage failure across the city",
    river: "Tullahan River / San Juan River",
    history: "QC has the largest flood-hazard area in Metro Manila (15.6 km2). Habagat (2012) caused a fatal landslide in Brgy. Commonwealth and severe flooding along EDSA and Roosevelt Ave.",
    localTip: "QC has different flood types by district: northern QC (Fairview/Novaliches) floods from the Tullahan; central QC from drainage failure; southern QC from flash floods and landslides. Learn which risk applies to your street.",
  },
  manila: {
    mechanism: "Pasig River overflow, San Juan River overflow, poor drainage, and Manila Bay storm surge",
    river: "Pasig River / San Juan River / Manila Bay",
    history: "During Habagat (2012), waist-high water flooded Manila City Hall. Carina (2024) put Manila under a state of calamity, with Espana Blvd residents using makeshift boats.",
    localTip: "Espana Blvd, Quiapo, Tondo, and Sampaloc are perennial flood zones. Avoid underpasses during heavy rain - they fill rapidly and have caused drownings.",
  },
  pasig: {
    mechanism: "Pasig River overflow and Manggahan Floodway overflow",
    river: "Pasig River / Manggahan Floodway",
    history: "Pasig is caught between two water systems. During Ondoy (2009) and Habagat (2012), the Manggahan Floodway overflowed and inundated large parts of the city.",
    localTip: "When Marikina River overflows, excess water enters the Manggahan Floodway and reaches Pasig within hours. If PAGASA reports Marikina River above 18 m, prepare to evacuate.",
  },
  taguig: {
    mechanism: "Laguna de Bay overflow and Manggahan Floodway overflow",
    river: "Laguna de Bay / Manggahan Floodway",
    history: "Lower Taguig barangays near Laguna de Bay flooded during Ondoy (2009) and Habagat (2012) when the Manggahan Floodway overflowed.",
    localTip: "BGC is elevated and generally safe, but lower Taguig near Laguna de Bay is vulnerable. If you live near the lake, monitor Laguna de Bay water levels - flooding comes from the lake rising, not just rain.",
  },
  san_juan: {
    mechanism: "San Juan River overflow",
    river: "San Juan River",
    history: "During Habagat (2012), the swollen San Juan River flooded UERM Hospital - several floors were inundated and staff faced food and medicine shortages.",
    localTip: "When the Pasig River is high, the San Juan River cannot drain, causing backwater flooding. Low-lying barangays along the river are at highest risk.",
  },
  mandaluyong: {
    mechanism: "poor drainage and proximity to Pasig River",
    river: "Pasig River",
    history: "Mandaluyong has chronic street flooding near City Hall and along Ortigas Ave. Floodwater can reach waist-deep and take up to 3 hours to recede after heavy rain.",
    localTip: "Flooding here is primarily drainage-driven - it can happen from intense rain alone, even without river overflow. Avoid low-lying streets near City Hall during downpours.",
  },
  pateros: {
    mechanism: "Pasig River overflow",
    river: "Pasig River",
    history: "Pateros sits directly on the Pasig River bank. Its small size and low elevation make it vulnerable whenever the Pasig River rises during upstream flooding.",
    localTip: "As Metro Manila's smallest municipality, Pateros has limited independent drainage. When the Pasig River rises, move valuables upstairs immediately - you have less buffer time than larger cities.",
  },
  makati: {
    mechanism: "poor drainage in low-lying areas and Pasig River overflow in riverside barangays",
    river: "Pasig River",
    history: "Makati's CBD has better drainage than most of Metro Manila, but riverside barangays like Guadalupe flood regularly when the Pasig River is high.",
    localTip: "The CBD drains faster, but if you live near Guadalupe or other riverside barangays, treat Pasig River alerts the same way Marikina residents treat theirs.",
  },
  pasay: {
    mechanism: "Manila Bay storm surge and coastal flooding with drainage failure",
    river: "Manila Bay coastline",
    history: "Roxas Boulevard and the airport area flood during storm surges and high tides. Habagat (2012) inundated Pasay's low-lying coastal strips.",
    localTip: "Storm surge from Manila Bay is the primary risk. If PAGASA issues a storm surge warning, move away from the coastal strip - Roxas Blvd and the airport area flood quickly.",
  },
  las_pinas: {
    mechanism: "Zapote River overflow and drainage failure",
    river: "Zapote River",
    history: "Zapote Junction floods recurrently because the river changes direction at the bridge, slowing water flow. A P2.5B flood control project was found to have failed to solve flooding as of late 2024.",
    localTip: "The Zapote River bottleneck at the bridge is a structural problem - it floods even during moderate rain. Avoid Zapote Junction during storms and use alternate routes.",
  },
  paranaque: {
    mechanism: "Manila Bay coastal flooding and Zapote/Paranaque River system overflow",
    river: "Manila Bay / Zapote River",
    history: "Coastal barangays near Manila Bay are vulnerable to storm surge. Inland areas flood from the Zapote/Paranaque River system during heavy monsoon rains.",
    localTip: "If you live near the coast, treat storm surge warnings seriously. Inland residents should watch for Zapote River level updates from the MMDA.",
  },
  muntinlupa: {
    mechanism: "Laguna de Bay overflow and localized drainage failure",
    river: "Laguna de Bay",
    history: "Muntinlupa was affected during Ondoy (2009). Its southern location means less exposure to the Marikina/Pasig/Tullahan systems, but lakeside barangays remain vulnerable.",
    localTip: "Your main flood risk is Laguna de Bay rising. If you live near the lakeshore, monitor lake water levels and be ready to move when upstream provinces receive heavy rain.",
  },
}

const FLOOD_PROFILES_TL: Record<string, FloodProfile> = {
  marikina: {
    mechanism: "pag-apaw ng Ilog Marikina",
    river: "Ilog Marikina",
    history: "Noong Ondoy (2009), umabot sa 21 metro ang Ilog Marikina at nalubog hanggang bubong ang mga bahay sa mga barangay sa tabi ng ilog. Noong Carina (2024), tinangay ng agos ang mga barge papunta sa mga tulay.",
    localTip: "Ang mga barangay sa tabi ng ilog ay maaaring bumaha sa loob ng ilang oras kapag malakas ang ulan sa Rizal. Mag-set ng evacuation trigger sa 16 m river warning level - huwag hintayin ang 18 m critical level.",
  },
  malabon: {
    mechanism: "pagtaas ng tubig-dagat sa Manila Bay at pag-apaw ng Ilog Tullahan",
    river: "Ilog Tullahan / Manila Bay",
    history: "Sa Malabon, may araw-araw na high-tide flooding kahit walang ulan. Noong Habagat (2012), tumagos ang storm surge sa mga seawall malapit sa fish port.",
    localTip: "Dalawang direksyon ang pinanggagalingan ng baha rito - dagat at ilog - kaya puwedeng tumagal ng ilang araw ang tubig. Mas ligtas kung permanenteng nakaangat ang saksakan at appliances.",
  },
  navotas: {
    mechanism: "paulit-ulit na tidal at coastal flooding mula sa Manila Bay",
    river: "Baybayin ng Manila Bay",
    history: "Araw-araw nakakaranas ng pagbaha ang Navotas kapag mataas ang tubig-dagat. Noong June 2024, nasira ang floodgate sa boundary ng Malabon-Navotas at naapektuhan ang humigit-kumulang 2,000 residente.",
    localTip: "Sa Navotas, ang galaw ng tubig-dagat ang madalas magdikta ng baha. Laging bantayan ang tide schedule ng PAGASA at panatilihing handa ang sandbag at waterproof na lalagyan.",
  },
  valenzuela: {
    mechanism: "pag-apaw ng Ilog Tullahan at sablay na drainage",
    river: "Ilog Tullahan",
    history: "Matinding binaha ang Valenzuela noong Ondoy (2009) at Carina (2024). Kapag may release sa La Mesa Dam, mas lumalala ang pagbaha sa ibabang bahagi ng Tullahan.",
    localTip: "Kapag may water release sa La Mesa Dam, puwedeng biglang tumaas ang tubig sa Tullahan River. Kung may abiso ng release, simulan agad ang paglikas sa mabababang lugar.",
  },
  caloocan: {
    mechanism: "pag-apaw ng Ilog Tullahan at mahinang drainage",
    river: "Ilog Tullahan",
    history: "Kilalang flood-prone ang South Caloocan at Fairview-Novaliches border. Noong Habagat (2012), umapaw ang Tullahan sa Atherton Bridge at tinangay ang mga bahay sa tabing-ilog.",
    localTip: "Magkaiba ang panganib sa Caloocan: sa timog, madalas dulot ng Tullahan; sa hilaga, lumalala kapag umaapaw ang La Mesa. Alamin kung alin ang tumatama sa barangay mo.",
  },
  quezon: {
    mechanism: "pinagsamang panganib mula sa Tullahan sa hilaga, San Juan River sa timog, at drainage failure sa gitna",
    river: "Ilog Tullahan / Ilog San Juan",
    history: "Ang Quezon City ang may pinakamalaking high flood-hazard area sa Metro Manila (15.6 km2). Noong Habagat (2012), nagkaroon ng landslide sa Brgy. Commonwealth at matinding baha sa EDSA at Roosevelt Ave.",
    localTip: "Iba-iba ang uri ng baha sa QC depende sa distrito. Sa hilaga, galing Tullahan; sa gitna, drainage; sa timog, mabilis na baha at landslide. Mahalaga na alam mo ang aktuwal na risk sa kalsada mo.",
  },
  manila: {
    mechanism: "pag-apaw ng Pasig at San Juan River, baradong drainage, at storm surge mula Manila Bay",
    river: "Ilog Pasig / Ilog San Juan / Manila Bay",
    history: "Noong Habagat (2012), umabot hanggang baywang ang baha sa paligid ng Manila City Hall. Noong Carina (2024), isinailalim sa state of calamity ang Maynila at may mga residenteng gumamit ng improvised na bangka sa Espana Blvd.",
    localTip: "Madalas bahain ang Espana Blvd, Quiapo, Tondo, at Sampaloc. Iwasan ang underpass kapag malakas ang ulan dahil mabilis mapuno ang tubig.",
  },
  pasig: {
    mechanism: "pag-apaw ng Ilog Pasig at Manggahan Floodway",
    river: "Ilog Pasig / Manggahan Floodway",
    history: "Nasa pagitan ng dalawang sistemang-tubig ang Pasig. Noong Ondoy (2009) at Habagat (2012), umapaw ang Manggahan Floodway at lumubog ang malalaking bahagi ng lungsod.",
    localTip: "Kapag umapaw ang Marikina River, dumadaloy ang sobrang tubig sa Manggahan Floodway at puwedeng umabot sa Pasig sa loob lang ng ilang oras. Kung lagpas 18 m ang Marikina warning, maghanda nang lumikas.",
  },
  taguig: {
    mechanism: "pagtaas ng tubig sa Laguna de Bay at pag-apaw ng Manggahan Floodway",
    river: "Laguna de Bay / Manggahan Floodway",
    history: "Nalubog ang ilang mabababang barangay sa Taguig noong Ondoy (2009) at Habagat (2012), lalo na ang mga malapit sa Laguna de Bay at floodway.",
    localTip: "Mas mataas ang BGC kaya mas ligtas, pero mas delikado ang mabababang bahagi ng Taguig malapit sa lawa. Bantayan ang antas ng tubig sa Laguna de Bay, dahil hindi ulan lang ang sanhi ng baha.",
  },
  san_juan: {
    mechanism: "pag-apaw ng Ilog San Juan",
    river: "Ilog San Juan",
    history: "Noong Habagat (2012), umapaw ang Ilog San Juan at binaha ang UERM Hospital; ilang palapag ang nalubog at nagkulang sa pagkain at gamot ang staff.",
    localTip: "Kapag mataas ang Pasig River, hirap umagos palabas ang San Juan River kaya nagkaka-backflow flooding. Pinaka-delikado ang mga mabababang barangay na katabi ng ilog.",
  },
  mandaluyong: {
    mechanism: "mahina ang drainage at malapit sa Ilog Pasig",
    river: "Ilog Pasig",
    history: "May paulit-ulit na street flooding sa Mandaluyong, lalo na malapit sa City Hall at Ortigas Ave. Umaabot minsan sa baywang ang tubig at inaabot ng hanggang 3 oras bago humupa.",
    localTip: "Karaniwan, drainage-driven ang baha sa Mandaluyong - puwede itong mangyari kahit walang pag-apaw ng ilog. Iwasan ang mga low-lying street malapit sa City Hall kapag buhos ang ulan.",
  },
  pateros: {
    mechanism: "pag-apaw ng Ilog Pasig",
    river: "Ilog Pasig",
    history: "Nasa mismong pampang ng Ilog Pasig ang Pateros. Dahil maliit ang lugar at mababa ang elevation, mabilis itong maapektuhan kapag tumataas ang tubig mula sa upstream flooding.",
    localTip: "Bilang pinakamaliit na bayan sa Metro Manila, limitado ang drainage buffer ng Pateros. Kapag tumataas ang Pasig River, ilipat agad sa taas ang mahahalagang gamit.",
  },
  makati: {
    mechanism: "drainage flooding sa mabababang lugar at pag-apaw ng Pasig sa mga riverside barangay",
    river: "Ilog Pasig",
    history: "Mas maayos ang drainage sa CBD ng Makati kumpara sa ibang lungsod, pero regular pa ring bumabaha sa mga barangay na malapit sa ilog gaya ng Guadalupe kapag mataas ang Pasig River.",
    localTip: "Mabilis humupa ang baha sa CBD, pero kung nasa Guadalupe o ibang riverside barangay ka, ituring na seryosong warning ang anumang alerto sa Pasig River.",
  },
  pasay: {
    mechanism: "storm surge mula Manila Bay at coastal flooding na may kasamang drainage failure",
    river: "Baybayin ng Manila Bay",
    history: "Madalas bumaha sa Roxas Boulevard at paligid ng airport kapag may storm surge at high tide. Noong Habagat (2012), malawak ang pagbaha sa mabababang coastal strip ng Pasay.",
    localTip: "Storm surge mula Manila Bay ang pangunahing panganib sa Pasay. Kapag may storm surge warning ang PAGASA, umiwas agad sa coastal strip lalo na sa Roxas Blvd at airport area.",
  },
  las_pinas: {
    mechanism: "pag-apaw ng Ilog Zapote at mahinang drainage",
    river: "Ilog Zapote",
    history: "Paulit-ulit ang baha sa Zapote Junction dahil nag-iiba ang direksyon ng agos sa tulay at bumabagal ang daloy. Noong huling bahagi ng 2024, napatunayang hindi pa rin naresolba ng malaking flood control project ang problema.",
    localTip: "Structural bottleneck ang Zapote River sa may tulay kaya bumabaha kahit hindi sobrang lakas ng ulan. Iwasan ang Zapote Junction kapag may bagyo at dumaan sa alternatibong ruta.",
  },
  paranaque: {
    mechanism: "coastal flooding mula Manila Bay at pag-apaw ng sistema ng Zapote/Paranaque River",
    river: "Manila Bay / Ilog Zapote",
    history: "Bulnerable sa storm surge ang mga coastal barangay sa Paranaque. Sa inland areas, madalas galing sa Zapote/Paranaque River system ang pagbaha kapag malakas ang habagat.",
    localTip: "Kung malapit ka sa baybayin, seryosohin ang storm surge warnings. Kung nasa inland ka, bantayan ang river level advisories ng MMDA para sa Zapote system.",
  },
  muntinlupa: {
    mechanism: "pagtaas ng Laguna de Bay at localized drainage failure",
    river: "Laguna de Bay",
    history: "Naapektuhan ang Muntinlupa noong Ondoy (2009). Mas malayo ito sa Marikina/Pasig/Tullahan systems, pero nananatiling delikado ang mga barangay sa tabi ng lawa.",
    localTip: "Sa Muntinlupa, pangunahing risk ang pagtaas ng tubig sa Laguna de Bay. Kung malapit ka sa lakeshore, bantayan ang antas ng lawa at maghanda sa maagang paglikas kapag malakas ang ulan sa mga probinsya sa itaas ng watershed.",
  },
}

function buildMeaningNow(city: City, locale: Locale): string {
  const profile = locale === "tl" ? FLOOD_PROFILES_TL[city.id] : FLOOD_PROFILES_EN[city.id]
  const coveragePct = (city.raw_coverage_ratio * 100).toFixed(0)
  const uncoveredKm2 = Math.max(0, city.total_high_hazard_area_km2 - city.raw_covered_area_km2).toFixed(1)
  const progressPct = city.avg_progress.toFixed(0)
  const ongoingCount = city.status_breakdown["On-Going"] ?? 0
  const notStartedCount = city.status_breakdown["Not Yet Started"] ?? 0
  const unfinishedCount = ongoingCount + notStartedCount
  const parts: string[] = []

  if (locale === "tl") {
    if (profile) {
      parts.push(`${city.name} ay madalas bahain dahil sa ${profile.mechanism}.`)
      parts.push(profile.history)
    } else {
      parts.push(`May mga lugar sa ${city.name} na classified bilang high flood hazard.`)
    }

    if (city.raw_coverage_ratio >= 0.95) {
      parts.push(`Sakop ng flood-control projects ang ${coveragePct}% ng high-hazard area (${city.total_high_hazard_area_km2.toFixed(1)} km2). Malakas ito na coverage, pero hindi ibig sabihin zero na ang risk - puwede pa ring kapusin ang imprastraktura kapag extreme ang ulan.`)
    } else if (city.raw_coverage_ratio >= 0.7) {
      parts.push(`Sakop ng flood-control projects ang ${coveragePct}% ng ${city.total_high_hazard_area_km2.toFixed(1)} km2 na high-hazard area. May ${uncoveredKm2} km2 pa ring hindi nasasaklaw, kaya mas mataas ang panganib sa mga lugar na iyon kapag malakas ang ulan.`)
    } else if (city.raw_coverage_ratio >= 0.4) {
      parts.push(`${coveragePct}% lang ng ${city.total_high_hazard_area_km2.toFixed(1)} km2 na high-hazard area ang may kalapit na flood-control projects. Ibig sabihin, may ${uncoveredKm2} km2 na kulang sa proteksyon - malaking gap ito kaya mahalaga ang maagang paghahanda.`)
    } else {
      parts.push(`Napakababa ng flood-control coverage - ${coveragePct}% lang ng ${city.total_high_hazard_area_km2.toFixed(1)} km2 na high-hazard area ang may kalapit na proyekto. Karamihan ng high-hazard zone ay kulang sa malapit na proteksyon.`)
    }

    if (unfinishedCount > 0) {
      parts.push(`May ${unfinishedCount} proyekto na ongoing o hindi pa nasisimulan (average completion: ${progressPct}%). Hangga't hindi pa ito tapos, limitado pa ang proteksiyong naibibigay.`)
    } else if (city.avg_progress >= 99.5) {
      parts.push(`Tapos na ang lahat ng ${city.project_count} proyekto. Pero tandaan: may limitasyon pa rin ang kahit kumpletong imprastraktura kapag sobrang tindi ng baha.`)
    }

    return parts.join(" ")
  }

  if (profile) {
    parts.push(`${city.name} is prone to flooding from ${profile.mechanism}.`)
    parts.push(profile.history)
  } else {
    parts.push(`${city.name} has areas classified as high flood hazard.`)
  }

  if (city.raw_coverage_ratio >= 0.95) {
    parts.push(`Flood-control projects cover ${coveragePct}% of the high-hazard area (${city.total_high_hazard_area_km2.toFixed(1)} km2). This is strong coverage, but it does not eliminate flood risk - heavy rain can still overwhelm infrastructure.`)
  } else if (city.raw_coverage_ratio >= 0.7) {
    parts.push(`Flood-control projects cover ${coveragePct}% of the ${city.total_high_hazard_area_km2.toFixed(1)} km2 high-hazard area. About ${uncoveredKm2} km2 remains uncovered. People in uncovered zones face significantly higher risk during heavy rain.`)
  } else if (city.raw_coverage_ratio >= 0.4) {
    parts.push(`Only ${coveragePct}% of the ${city.total_high_hazard_area_km2.toFixed(1)} km2 high-hazard area is covered by nearby flood-control projects. That leaves ${uncoveredKm2} km2 without nearby protection - a large gap that means early preparation is critical.`)
  } else {
    parts.push(`Flood-control coverage is very low - only ${coveragePct}% of the ${city.total_high_hazard_area_km2.toFixed(1)} km2 high-hazard area has nearby projects. Most of the high-hazard zone has no nearby protection.`)
  }

  if (unfinishedCount > 0) {
    parts.push(`${unfinishedCount} project${unfinishedCount > 1 ? "s are" : " is"} still ongoing or not yet started (average completion: ${progressPct}%). Until these are finished, their protection is partial.`)
  } else if (city.avg_progress >= 99.5) {
    parts.push(`All ${city.project_count} projects are complete. However, completed infrastructure still has design limits - it can be overwhelmed by extreme events.`)
  }

  return parts.join(" ")
}

function buildActionItems(city: City, locale: Locale): string[] {
  const profile = locale === "tl" ? FLOOD_PROFILES_TL[city.id] : FLOOD_PROFILES_EN[city.id]
  const score = city.effective_coverage_score
  const items: string[] = []

  if (locale === "tl") {
    items.push("Maghanda na ng go-bag ngayon: inuming tubig, flashlight, gamot, IDs, phone charger, at cash.")

    if (profile) {
      items.push(profile.localTip)
    }

    if (score < 0.5) {
      items.push("Dahil kulang pa sa kalahati ang covered hazard area, magtakda ng maagang family evacuation trigger - halimbawa, hanggang-bukong na tubig sa kalsada o 1 oras na tuloy-tuloy na malakas na ulan.")
      items.push("Alamin na ngayon ang pinakamalapit na evacuation center at ang pinakaligtas na daan papunta roon bago lumala ang sitwasyon.")
    } else if (score < 0.7) {
      items.push("Malaki pa rin ang coverage gaps. Ilipat sa mas mataas na lugar ang mahahalagang gamit, dokumento, at appliances bago pa magsimula ang malakas na ulan.")
      items.push("Alamin ang pinakamalapit na evacuation center at umalis nang maaga kapag nagsisimula nang pumasok ang tubig sa kalsada ninyo.")
    } else if (score < 0.85) {
      items.push("Maganda ang coverage pero hindi pa kumpleto. Itago ang importanteng dokumento sa waterproof bag at ilagay ang electronics sa taas ng posibleng baha.")
      items.push("Kahit may flood-control infrastructure, bantayan pa rin ang advisories ng PAGASA - puwedeng sumobra ang ulan sa anumang sistema.")
    } else {
      items.push("Malakas ang coverage, pero walang imprastrakturang ganap na flood-proof. Panatilihing handa ang go-bag at siguraduhing alam ng pamilya ang lokasyon ng evacuation center.")
      items.push("Manatiling alerto kapag Orange o Red rainfall warning ng PAGASA - kahit well-covered na lugar ay puwede pa ring bahain sa matitinding event gaya ng Ondoy (2009).")
    }

    items.push("Subaybayan ang rainfall warnings ng PAGASA at flood advisories ng LGU. Sundin ang abiso ng barangay dahil sila ang pinakaalam sa kondisyon ng inyong kalsada.")
    return items
  }

  items.push("Prepare a go-bag now: drinking water, flashlight, medicines, IDs, phone charger, and cash.")

  if (profile) {
    items.push(profile.localTip)
  }

  if (score < 0.5) {
    items.push("With less than half the hazard area covered, set a family evacuation trigger early - for example, ankle-deep street water or 1 hour of nonstop heavy rain.")
    items.push("Identify your nearest evacuation center and the safest walking route to get there before conditions worsen.")
  } else if (score < 0.7) {
    items.push("Coverage gaps remain significant. Move valuables, documents, and appliances to upper floors or high shelves before heavy rain starts.")
    items.push("Know your nearest evacuation center and leave early if water begins entering your street.")
  } else if (score < 0.85) {
    items.push("Coverage is good but not complete. Keep important documents in a waterproof bag and store electronics above potential flood level.")
    items.push("Even with flood-control infrastructure nearby, monitor PAGASA advisories - extreme rainfall can overwhelm any system.")
  } else {
    items.push("Coverage is strong, but no infrastructure is flood-proof. Keep a go-bag ready and know your evacuation center location.")
    items.push("Stay alert during PAGASA Orange and Red rainfall warnings - even well-covered areas can flood during extreme events like Ondoy (2009).")
  }

  items.push("Track PAGASA rainfall warnings and your LGU's flood advisories. Follow local barangay announcements - they know your streets best.")
  return items
}

function projectStatusLabel(status: string, t: (key: string) => string): string {
  if (status === "Completed") return t("status.completed")
  if (status === "On-Going") return t("status.onGoing")
  if (status === "Not Yet Started") return t("status.notYetStarted")
  return status
}

export function CityDetail({ city, projects, onClose }: Props): JSX.Element {
  const { t, locale } = useLocale()
  const [sortKey, setSortKey] = useState<SortKey>("progress")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const exposureGap = Math.max(0, 1 - city.raw_coverage_ratio)
  const readinessGap = Math.max(0, 1 - city.avg_progress / 100)
  const meaningNow = buildMeaningNow(city, locale)
  const actionItems = buildActionItems(city, locale)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1
    return (a[sortKey] - b[sortKey]) * mul
  })

  const statusEntries = Object.entries(city.status_breakdown)
  const totalStatusCount = statusEntries.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <h2 className="text-lg font-semibold">{city.name}</h2>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="text-3xl font-bold"
              style={{ color: scoreColor(city.effective_coverage_score) }}
            >
              {formatPercent(city.effective_coverage_score)}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: scoreColor(city.effective_coverage_score) + "20",
                color: scoreColor(city.effective_coverage_score),
              }}
            >
              {t(scoreLabelKey(city.effective_coverage_score))}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <MetricCard label={t("city.effectiveCoverage")} value={formatPercent(city.effective_coverage_score)} />
            <MetricCard label={t("city.rawCoverage")} value={formatPercent(city.raw_coverage_ratio)} />
            <MetricCard label={t("city.avgProgress")} value={formatPercentRaw(city.avg_progress)} />
            <MetricCard label={t("city.exposureGap")} value={formatPercent(exposureGap)} />
            <MetricCard label={t("city.readinessGap")} value={formatPercent(readinessGap)} />
            <MetricCard label={t("city.highHazardArea")} value={`${city.total_high_hazard_area_km2.toFixed(2)} km²`} />
            <MetricCard label={t("city.coveredArea")} value={`${city.raw_covered_area_km2.toFixed(2)} km²`} />
            <MetricCard label={t("city.totalProjects")} value={city.project_count.toString()} />
            <div className="col-span-2">
              <MetricCard label={t("city.totalBudget")} value={formatPHP(city.budget_total_php)} />
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-200">
              {t("city.whatItMeans")}
            </h3>
            <p className="text-sm leading-6 text-rose-50">{meaningNow}</p>
          </div>

          <div className="mb-4 rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 py-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-200">
              {t("city.whatToDo")}
            </h3>
            <ul className="space-y-1.5 text-sm leading-6 text-amber-50">
              {actionItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 text-amber-300">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {statusEntries.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("city.projectStatus")}
              </h3>
              <div className="flex h-3 overflow-hidden rounded-full bg-[#0f172a]">
                {statusEntries.map(([status, count]) => (
                  <div
                    key={status}
                    className="h-full"
                    style={{
                      width: `${(count / totalStatusCount) * 100}%`,
                      backgroundColor: status === "Completed" ? "#22c55e" : status === "On-Going" ? "#3b82f6" : "#94a3b8",
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {statusEntries.map(([status, count]) => (
                  <span key={status} className="text-xs text-slate-400">
                    <span
                      className="mr-1 inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: status === "Completed" ? "#22c55e" : status === "On-Going" ? "#3b82f6" : "#94a3b8",
                      }}
                    />
                    {projectStatusLabel(status, t)}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("city.aiAnalysis")}
            </h3>
            <AIAnalysis cityId={city.id} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("city.projects")} ({projects.length})
            </h3>
            <div className="max-h-64 overflow-auto rounded-lg border border-[#334155]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0f172a] text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("table.name")}</th>
                    <th className="px-3 py-2 font-medium">{t("table.status")}</th>
                    <th
                      className="cursor-pointer px-3 py-2 font-medium hover:text-slate-200"
                      onClick={() => toggleSort("progress")}
                    >
                      {t("table.progress")} {sortKey === "progress" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 font-medium hover:text-slate-200"
                      onClick={() => toggleSort("budget")}
                    >
                      {t("table.budget")} {sortKey === "budget" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProjects.map((p) => (
                    <tr key={p.id} className="border-t border-[#334155]/50 hover:bg-[#334155]/30">
                      <td className="max-w-[160px] truncate px-3 py-2 text-slate-300" title={p.name}>
                        {p.name}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: p.status === "Completed" ? "#22c55e20" : "#3b82f620",
                            color: p.status === "Completed" ? "#22c55e" : "#3b82f6",
                          }}
                        >
                          {projectStatusLabel(p.status, t)}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">{p.progress.toFixed(1)}%</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{formatPHP(p.budget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#0f172a] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  )
}
