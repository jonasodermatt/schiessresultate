"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { calculateRankingPayouts } from "../program/payout-utils";

type Shooter = {
  id: string;
  first_name: string;
  last_name: string;
  birth_year: number | null;
};

type Registration = {
  id: string;
  shooter_id: string;
  start_number: number | null;
};

type Stitch = {
  id: string;
  name: string;
  sort_order: number;
  price_chf: number;
  additional_pass_price_chf: number;
  jj_price_chf: number | null;
  jj_additional_pass_price_chf: number | null;
  payout_enabled: boolean;
  payout_percentage: number;
  payout_winner_mode: "fraction" | "fixed" | "all";
  payout_winner_numerator: number;
  payout_winner_denominator: number;
  payout_fixed_winner_count: number | null;
  payout_min_first_chf: number | null;
  payout_min_second_chf: number | null;
  payout_min_third_chf: number | null;
  payout_min_last_chf: number | null;
  payout_step_chf: number;
  payout_curve_exponent: number;
  payout_instant_max_chf: number | null;
};

type RegistrationStitch = {
  id: string;
  registration_id: string;
  event_stitch_id: string;
  registered_passes: number;
  status: string;
  price_override_chf: number | null;
  additional_pass_price_override_chf: number | null;
};


type InstantRule = {
  event_stitch_id: string;
  score: number;
  first_amount_chf: number;
  repeat_amount_chf: number;
};

type RankingRow = {
  event_stitch_id: string; registration_id: string; shooter_id: string; master_number: number;
  first_name: string; last_name: string; birth_year: number | null; ranking_type: "total" | "best" | "best_n" | "section" | "special" | null;
  best_n: number | null; special_code: string | null; total_score: number; series_total: number; tie_break_score: number | null; hit_count: number; ranked_shots: number[];
};

type OpenPayoutRow = {
  registrationId: string; startNumber: number | null; shooterName: string; stitchId: string; stitchName: string; instant: number; ranking: number; total: number; rank: number | null;
};

function compareNumbersDesc(a: number | null | undefined, b: number | null | undefined) { const av=a ?? Number.NEGATIVE_INFINITY; const bv=b ?? Number.NEGATIVE_INFINITY; return av===bv ? 0 : bv-av; }
function compareArraysDesc(a:number[], b:number[]) { for(let i=0;i<Math.max(a.length,b.length);i++){ const av=a[i]??Number.NEGATIVE_INFINITY; const bv=b[i]??Number.NEGATIVE_INFINITY; if(av!==bv)return bv-av;} return 0; }
function bestNTotal(row:RankingRow){ return row.ranked_shots.slice(0,row.best_n??0).reduce((s,v)=>s+v,0); }
function compareRankingRows(a:RankingRow,b:RankingRow){
  let r=0;
  if(a.special_code==="RUETLI"){ r=compareNumbersDesc(a.total_score+a.hit_count,b.total_score+b.hit_count); if(r)return r; r=compareArraysDesc(a.ranked_shots,b.ranked_shots); if(r)return r; }
  else if(a.ranking_type==="section"){ r=compareNumbersDesc(a.total_score,b.total_score); if(r)return r; r=compareNumbersDesc(a.tie_break_score,b.tie_break_score); if(r)return r; r=compareNumbersDesc(a.series_total,b.series_total); if(r)return r; }
  else if(a.ranking_type==="best"){ r=compareArraysDesc(a.ranked_shots,b.ranked_shots); if(r)return r; }
  else if(a.ranking_type==="best_n"){ const n=a.best_n??0; r=compareNumbersDesc(bestNTotal(a),bestNTotal(b)); if(r)return r; r=compareArraysDesc(a.ranked_shots.slice(n),b.ranked_shots.slice(n)); if(r)return r; }
  else { r=compareNumbersDesc(a.total_score,b.total_score); if(r)return r; r=compareArraysDesc(a.ranked_shots,b.ranked_shots); if(r)return r; }
  if(a.birth_year!==b.birth_year){ if(a.birth_year===null)return 1; if(b.birth_year===null)return -1; return a.birth_year-b.birth_year; }
  return a.master_number-b.master_number;
}

type RevenueRow = {
  registrationStitchId: string;
  registrationId: string;
  startNumber: number | null;
  shooterName: string;
  birthYear: number | null;
  category: string;
  stitchId: string;
  stitchName: string;
  registeredPasses: number;
  basePrice: number;
  additionalPassPrice: number;
  additionalPasses: number;
  additionalRevenue: number;
  total: number;
  priceSource: "Individuell" | "JJ" | "Standard";
  baseOverride: number | null;
  additionalOverride: number | null;
};

function categoryForBirthYear(
  birthYear: number | null,
  eventYear: number | null
) {
  if (birthYear === null || eventYear === null) return "–";

  const age = eventYear - birthYear;

  if (age >= 10 && age <= 16) return "JJ";
  if (age >= 17 && age <= 20) return "J";
  if (age >= 21 && age <= 45) return "E";
  if (age >= 46 && age <= 59) return "S";
  if (age >= 60 && age <= 69) return "V";
  if (age >= 70) return "SV";

  return "–";
}

export default function ShootingEventFinancesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;

  const [eventName, setEventName] = useState("");
  const [eventYear, setEventYear] = useState<number | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [shooters, setShooters] = useState<Shooter[]>([]);
  const [stitches, setStitches] = useState<Stitch[]>([]);
  const [registrationStitches, setRegistrationStitches] = useState<RegistrationStitch[]>([]);
  const [instantRules, setInstantRules] = useState<InstantRule[]>([]);
  const [rankingRows, setRankingRows] = useState<RankingRow[]>([]);

  const [stitchDrafts, setStitchDrafts] = useState<
    Record<
      string,
      {
        standard: string;
        jj: string;
        additional: string;
        jjAdditional: string;
      }
    >
  >({});

  const [overrideDrafts, setOverrideDrafts] = useState<
    Record<
      string,
      {
        base: string;
        additional: string;
      }
    >
  >({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const { data: eventData, error: eventError } = await supabase
        .from("shooting_events")
        .select("id, name, event_date")
        .eq("id", eventId)
        .single();

      if (eventError || !eventData) {
        throw new Error(
          eventError?.message ?? "Schiessanlass nicht gefunden."
        );
      }

      setEventName(eventData.name);
      setEventYear(
        eventData.event_date
          ? Number(eventData.event_date.slice(0, 4))
          : null
      );

      const [
        { data: registrationData, error: registrationError },
        { data: stitchData, error: stitchError },
      ] = await Promise.all([
        supabase
          .from("shooting_event_registrations")
          .select("id, shooter_id, start_number")
          .eq("shooting_event_id", eventId),
        supabase
          .from("shooting_event_stitches")
          .select(
            "id, name, sort_order, price_chf, additional_pass_price_chf, jj_price_chf, jj_additional_pass_price_chf, payout_enabled, payout_percentage, payout_winner_mode, payout_winner_numerator, payout_winner_denominator, payout_fixed_winner_count, payout_min_first_chf, payout_min_second_chf, payout_min_third_chf, payout_min_last_chf, payout_step_chf, payout_curve_exponent, payout_instant_max_chf"
          )
          .eq("shooting_event_id", eventId)
          .eq("active", true)
          .order("sort_order"),
      ]);

      if (registrationError) {
        throw new Error(registrationError.message);
      }

      if (stitchError) {
        throw new Error(stitchError.message);
      }

      const loadedRegistrations =
        (registrationData ?? []) as Registration[];

      const loadedStitches = ((stitchData ?? []) as Stitch[]).map(
        (row) => ({
          ...row,
          price_chf: Number(row.price_chf ?? 0),
          additional_pass_price_chf: Number(
            row.additional_pass_price_chf ?? 0
          ),
          jj_price_chf:
            row.jj_price_chf === null
              ? null
              : Number(row.jj_price_chf),
          jj_additional_pass_price_chf:
            row.jj_additional_pass_price_chf === null
              ? null
              : Number(row.jj_additional_pass_price_chf),
          payout_percentage: Number(row.payout_percentage ?? 60),
          payout_winner_numerator: Number(row.payout_winner_numerator ?? 2),
          payout_winner_denominator: Number(row.payout_winner_denominator ?? 3),
          payout_fixed_winner_count: row.payout_fixed_winner_count == null ? null : Number(row.payout_fixed_winner_count),
          payout_min_first_chf: row.payout_min_first_chf == null ? null : Number(row.payout_min_first_chf),
          payout_min_second_chf: row.payout_min_second_chf == null ? null : Number(row.payout_min_second_chf),
          payout_min_third_chf: row.payout_min_third_chf == null ? null : Number(row.payout_min_third_chf),
          payout_min_last_chf: row.payout_min_last_chf == null ? null : Number(row.payout_min_last_chf),
          payout_step_chf: Number(row.payout_step_chf ?? 1),
          payout_curve_exponent: Number(row.payout_curve_exponent ?? 0.6),
          payout_instant_max_chf: row.payout_instant_max_chf == null ? null : Number(row.payout_instant_max_chf),
        })
      );

      setRegistrations(loadedRegistrations);
      setStitches(loadedStitches);

      setStitchDrafts(
        Object.fromEntries(
          loadedStitches.map((stitch) => [
            stitch.id,
            {
              standard: String(stitch.price_chf),
              jj:
                stitch.jj_price_chf === null
                  ? ""
                  : String(stitch.jj_price_chf),
              additional: String(
                stitch.additional_pass_price_chf
              ),
              jjAdditional:
                stitch.jj_additional_pass_price_chf === null
                  ? ""
                  : String(
                      stitch.jj_additional_pass_price_chf
                    ),
            },
          ])
        )
      );

      const shooterIds = Array.from(
        new Set(
          loadedRegistrations
            .map((registration) => registration.shooter_id)
            .filter(Boolean)
        )
      );

      if (shooterIds.length > 0) {
        const { data: shooterData, error: shooterError } =
          await supabase
            .from("shooters")
            .select(
              "id, first_name, last_name, birth_year"
            )
            .in("id", shooterIds);

        if (shooterError) {
          throw new Error(shooterError.message);
        }

        setShooters((shooterData ?? []) as Shooter[]);
      } else {
        setShooters([]);
      }

      const registrationIds = loadedRegistrations.map(
        (registration) => registration.id
      );

      if (registrationIds.length > 0) {
        const {
          data: registrationStitchData,
          error: registrationStitchError,
        } = await supabase
          .from("shooting_event_registration_stitches")
          .select(
            "id, registration_id, event_stitch_id, registered_passes, status, price_override_chf, additional_pass_price_override_chf"
          )
          .in("registration_id", registrationIds);

        if (registrationStitchError) {
          throw new Error(
            registrationStitchError.message
          );
        }

        const loadedRegistrationStitches =
          ((registrationStitchData ?? []) as RegistrationStitch[]).map(
            (row) => ({
              ...row,
              price_override_chf:
                row.price_override_chf === null
                  ? null
                  : Number(row.price_override_chf),
              additional_pass_price_override_chf:
                row.additional_pass_price_override_chf === null
                  ? null
                  : Number(
                      row.additional_pass_price_override_chf
                    ),
            })
          );

        setRegistrationStitches(
          loadedRegistrationStitches
        );

        setOverrideDrafts(
          Object.fromEntries(
            loadedRegistrationStitches.map((row) => [
              row.id,
              {
                base:
                  row.price_override_chf === null
                    ? ""
                    : String(row.price_override_chf),
                additional:
                  row.additional_pass_price_override_chf ===
                  null
                    ? ""
                    : String(
                        row.additional_pass_price_override_chf
                      ),
              },
            ])
          )
        );
      } else {
        setRegistrationStitches([]);
        setOverrideDrafts({});
      }

      const stitchIds = loadedStitches.map((stitch) => stitch.id);
      if (stitchIds.length > 0) {
        const [{ data: ruleData, error: ruleError }, { data: rankingData, error: rankingError }] = await Promise.all([
          supabase.from("shooting_event_stitch_instant_payout_rules").select("event_stitch_id, score, first_amount_chf, repeat_amount_chf").in("event_stitch_id", stitchIds),
          supabase.from("shooting_event_ranking_base").select("event_stitch_id, registration_id, shooter_id, master_number, first_name, last_name, birth_year, ranking_type, best_n, special_code, total_score, series_total, tie_break_score, hit_count, ranked_shots").eq("shooting_event_id", eventId).eq("status", "completed"),
        ]);
        if (ruleError) throw new Error(`Sofortauszahlungsregeln: ${ruleError.message}`);
        if (rankingError) throw new Error(`Ranglistenbasis: ${rankingError.message}`);
        setInstantRules(((ruleData ?? []) as InstantRule[]).map(r => ({...r, score:Number(r.score), first_amount_chf:Number(r.first_amount_chf), repeat_amount_chf:Number(r.repeat_amount_chf)})));
        setRankingRows(((rankingData ?? []) as RankingRow[]).map(r => ({...r, total_score:Number(r.total_score), series_total:Number(r.series_total), hit_count:Number(r.hit_count), ranked_shots:r.ranked_shots ?? []})));
      } else { setInstantRules([]); setRankingRows([]); }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      await loadData();
    }

    void init();
  }, [eventId, router]);

  const shooterById = useMemo(
    () =>
      new Map(
        shooters.map((shooter) => [
          shooter.id,
          shooter,
        ])
      ),
    [shooters]
  );

  const registrationById = useMemo(
    () =>
      new Map(
        registrations.map((registration) => [
          registration.id,
          registration,
        ])
      ),
    [registrations]
  );

  const stitchById = useMemo(
    () =>
      new Map(
        stitches.map((stitch) => [
          stitch.id,
          stitch,
        ])
      ),
    [stitches]
  );

  const revenueRows = useMemo<RevenueRow[]>(() => {
    return registrationStitches
      .map((registrationStitch) => {
        const registration = registrationById.get(
          registrationStitch.registration_id
        );

        const stitch = stitchById.get(
          registrationStitch.event_stitch_id
        );

        if (!registration || !stitch) {
          return null;
        }

        const shooter = shooterById.get(
          registration.shooter_id
        );

        const birthYear = shooter?.birth_year ?? null;
        const category = categoryForBirthYear(
          birthYear,
          eventYear
        );

        const registeredPasses = Math.max(
          1,
          Number(
            registrationStitch.registered_passes || 1
          )
        );

        let basePrice = Number(stitch.price_chf || 0);
        let additionalPassPrice = Number(
          stitch.additional_pass_price_chf || 0
        );
        let priceSource: RevenueRow["priceSource"] =
          "Standard";

        if (category === "JJ") {
          if (stitch.jj_price_chf !== null) {
            basePrice = Number(stitch.jj_price_chf);
            priceSource = "JJ";
          }

          if (
            stitch.jj_additional_pass_price_chf !== null
          ) {
            additionalPassPrice = Number(
              stitch.jj_additional_pass_price_chf
            );
          }
        }

        if (
          registrationStitch.price_override_chf !== null
        ) {
          basePrice = Number(
            registrationStitch.price_override_chf
          );
          priceSource = "Individuell";
        }

        if (
          registrationStitch
            .additional_pass_price_override_chf !== null
        ) {
          additionalPassPrice = Number(
            registrationStitch
              .additional_pass_price_override_chf
          );
          priceSource = "Individuell";
        }

        const additionalPasses = Math.max(
          0,
          registeredPasses - 1
        );

        const additionalRevenue =
          additionalPasses * additionalPassPrice;

        return {
          registrationStitchId: registrationStitch.id,
          registrationId: registration.id,
          startNumber: registration.start_number,
          shooterName: shooter
            ? `${shooter.last_name} ${shooter.first_name}`
            : "Unbekannter Schütze",
          birthYear,
          category,
          stitchId: stitch.id,
          stitchName: stitch.name,
          registeredPasses,
          basePrice,
          additionalPassPrice,
          additionalPasses,
          additionalRevenue,
          total: basePrice + additionalRevenue,
          priceSource,
          baseOverride:
            registrationStitch.price_override_chf,
          additionalOverride:
            registrationStitch
              .additional_pass_price_override_chf,
        };
      })
      .filter(
        (row): row is RevenueRow => row !== null
      )
      .sort((a, b) => {
        const sbDiff =
          (a.startNumber ?? 999999) -
          (b.startNumber ?? 999999);

        if (sbDiff !== 0) return sbDiff;

        return a.stitchName.localeCompare(
          b.stitchName,
          "de-CH"
        );
      });
  }, [
    registrationStitches,
    registrationById,
    stitchById,
    shooterById,
    eventYear,
  ]);

  const totalRevenue = useMemo(
    () =>
      revenueRows.reduce(
        (sum, row) => sum + row.total,
        0
      ),
    [revenueRows]
  );

  const payoutData = useMemo(() => {
    const openRows: OpenPayoutRow[] = [];
    const byStitch = new Map<string, { instant:number; available:number; quotePercentage:number; ranking:number; budget:number; rankingPool:number }>();
    for (const stitch of stitches) {
      const revenue = revenueRows.filter(r => r.stitchId === stitch.id).reduce((sum,r)=>sum+r.total,0);
      const ranked = rankingRows.filter(r => r.event_stitch_id === stitch.id).slice().sort(compareRankingRows);
      const rules = instantRules.filter(r => r.event_stitch_id === stitch.id);
      const ruleByScore = new Map(rules.map(r => [Number(r.score), r]));
      const instantByRegistration = new Map<string, number>();
      for (const row of ranked) {
        const counts = new Map<number,number>();
        for (const score of row.ranked_shots) counts.set(Number(score),(counts.get(Number(score))??0)+1);
        let instant=0;
        for (const [score,count] of counts) { const rule=ruleByScore.get(score); if(!rule||count<=0)continue; instant += rule.first_amount_chf + Math.max(0,count-1)*rule.repeat_amount_chf; }
        if (stitch.payout_instant_max_chf != null) instant=Math.min(instant,stitch.payout_instant_max_chf);
        instantByRegistration.set(row.registration_id, Math.round(instant*100)/100);
      }
      const instantTotal=Array.from(instantByRegistration.values()).reduce((a,b)=>a+b,0);
      const calc = stitch.payout_enabled ? calculateRankingPayouts({ participantCount: ranked.length, revenueChf: revenue, instantPayoutTotalChf: instantTotal, config:{ payoutPercentage:stitch.payout_percentage, winnerMode:stitch.payout_winner_mode, winnerNumerator:stitch.payout_winner_numerator, winnerDenominator:stitch.payout_winner_denominator, fixedWinnerCount:stitch.payout_fixed_winner_count, minimumFirst:stitch.payout_min_first_chf, minimumSecond:stitch.payout_min_second_chf, minimumThird:stitch.payout_min_third_chf, minimumLast:stitch.payout_min_last_chf, payoutStep:stitch.payout_step_chf, curveExponent:stitch.payout_curve_exponent } }) : {grossPrizePool:0,rankingPrizePool:0,payouts:[]};
      const payoutByRank=new Map(calc.payouts.map(p=>[p.rank,p.amount]));
      let rankingTotal=0;
      ranked.forEach((row,index)=>{
        const rank=index+1; const instant=stitch.payout_enabled ? (instantByRegistration.get(row.registration_id)??0) : 0; const ranking=stitch.payout_enabled ? (payoutByRank.get(rank)??0) : 0; rankingTotal+=ranking;
        if(instant>0||ranking>0){ const reg=registrationById.get(row.registration_id); openRows.push({registrationId:row.registration_id,startNumber:reg?.start_number??null,shooterName:`${row.last_name} ${row.first_name}`,stitchId:stitch.id,stitchName:stitch.name,instant,ranking,total:Math.round((instant+ranking)*100)/100,rank:ranking>0?rank:null}); }
      });
      const effectiveInstant = stitch.payout_enabled ? instantTotal : 0;
      const available = Math.max(0, Math.round((revenue - effectiveInstant) * 100) / 100);
      const roundedRankingTotal = Math.round(rankingTotal * 100) / 100;
      const effectiveQuotePercentage =
        stitch.payout_enabled && available > 0
          ? (roundedRankingTotal / available) * 100
          : 0;

      byStitch.set(stitch.id,{
        instant: effectiveInstant,
        available,
        quotePercentage: effectiveQuotePercentage,
        ranking: roundedRankingTotal,
        budget: calc.grossPrizePool,
        rankingPool: calc.rankingPrizePool
      });
    }
    return { openRows, byStitch };
  }, [stitches,revenueRows,rankingRows,instantRules,registrationById]);

  const stitchSummary = useMemo(() => stitches.map((stitch) => {
    const rows=revenueRows.filter(r=>r.stitchId===stitch.id); const payout=payoutData.byStitch.get(stitch.id);
    const revenue = rows.reduce((sum,r)=>sum+r.total,0);
    return {
      stitch,
      registrations: rows.length,
      passes: rows.reduce((sum,r)=>sum+r.registeredPasses,0),
      revenue,
      instant: payout?.instant ?? 0,
      available: payout?.available ?? revenue,
      quotePercentage: payout?.quotePercentage ?? 0,
      ranking: payout?.ranking ?? 0
    };
  }), [stitches,revenueRows,payoutData]);

  const participantSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        registrationId: string;
        startNumber: number | null;
        shooterName: string;
        total: number;
      }
    >();

    for (const row of revenueRows) {
      const current = map.get(row.registrationId);

      if (current) {
        current.total += row.total;
      } else {
        map.set(row.registrationId, {
          registrationId: row.registrationId,
          startNumber: row.startNumber,
          shooterName: row.shooterName,
          total: row.total,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        (a.startNumber ?? 999999) -
        (b.startNumber ?? 999999)
    );
  }, [revenueRows]);

  function money(value: number) {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: "CHF",
      minimumFractionDigits: 2,
    }).format(value);
  }

  function exportPayoutDetailsCsv() {
    const rows = payoutData.openRows
      .slice()
      .sort((a, b) =>
        (a.startNumber ?? 999999) - (b.startNumber ?? 999999) ||
        a.stitchName.localeCompare(b.stitchName, "de-CH")
      );

    const header = [
      "SB",
      "Schuetze",
      "Stich",
      "Rang",
      "Sofortauszahlung CHF",
      "Rangauszahlung CHF",
      "Total CHF",
    ];

    const escapeCsv = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const lines = [
      header.map(escapeCsv).join(";"),
      ...rows.map((row) =>
        [
          row.startNumber ?? "",
          row.shooterName,
          row.stitchName,
          row.rank ?? "",
          row.instant.toFixed(2),
          row.ranking.toFixed(2),
          row.total.toFixed(2),
        ]
          .map(escapeCsv)
          .join(";")
      ),
    ];

    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventName || "Auszahlungen"}-Einzelliste.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function saveStitchPricing(stitchId: string) {
    const draft = stitchDrafts[stitchId];

    if (!draft) return;

    const standard = Number(draft.standard);
    const additional = Number(draft.additional);

    if (
      !Number.isFinite(standard) ||
      standard < 0 ||
      !Number.isFinite(additional) ||
      additional < 0
    ) {
      setMessage(
        "Standardpreise müssen gültige Werte ab 0 sein."
      );
      return;
    }

    const jj =
      draft.jj.trim() === ""
        ? null
        : Number(draft.jj);

    const jjAdditional =
      draft.jjAdditional.trim() === ""
        ? null
        : Number(draft.jjAdditional);

    if (
      (jj !== null &&
        (!Number.isFinite(jj) || jj < 0)) ||
      (jjAdditional !== null &&
        (!Number.isFinite(jjAdditional) ||
          jjAdditional < 0))
    ) {
      setMessage(
        "JJ-Preise müssen leer oder gültige Werte ab 0 sein."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("shooting_event_stitches")
        .update({
          price_chf: standard,
          additional_pass_price_chf: additional,
          jj_price_chf: jj,
          jj_additional_pass_price_chf:
            jjAdditional,
        })
        .eq("id", stitchId);

      if (error) throw new Error(error.message);

      await loadData();
      setMessage("Stichpreise gespeichert.");
    } catch (error) {
      setMessage(
        `Preise konnten nicht gespeichert werden: ${
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveOverride(
    registrationStitchId: string
  ) {
    const draft =
      overrideDrafts[registrationStitchId];

    if (!draft) return;

    const base =
      draft.base.trim() === ""
        ? null
        : Number(draft.base);

    const additional =
      draft.additional.trim() === ""
        ? null
        : Number(draft.additional);

    if (
      (base !== null &&
        (!Number.isFinite(base) || base < 0)) ||
      (additional !== null &&
        (!Number.isFinite(additional) ||
          additional < 0))
    ) {
      setMessage(
        "Individuelle Preise müssen leer oder gültige Werte ab 0 sein."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from(
          "shooting_event_registration_stitches"
        )
        .update({
          price_override_chf: base,
          additional_pass_price_override_chf:
            additional,
        })
        .eq("id", registrationStitchId);

      if (error) throw new Error(error.message);

      await loadData();
      setMessage(
        "Individueller Preis gespeichert."
      );
    } catch (error) {
      setMessage(
        `Individueller Preis konnte nicht gespeichert werden: ${
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">
          Finanzen werden geladen...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link
            href="/dashboard"
            className="font-bold text-slate-900"
          >
            EasyShooter
          </Link>

          <Link
            href={`/shooting-events/${eventId}`}
            className="text-sm text-slate-600"
          >
            ← Anlass
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">
              {eventName}
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Finanzen
            </h1>

            <p className="mt-2 text-slate-600">
              Standard-, JJ- und individuelle Preise verwalten und Einnahmen auswerten.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50"
          >
            Übersicht drucken
          </button>
        </div>

        {message && (
          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Preiskonfiguration
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Leere JJ-Felder verwenden automatisch den Standardpreis.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">
                    Stich
                  </th>
                  <th className="py-2 pr-4">
                    Standard
                  </th>
                  <th className="py-2 pr-4">
                    JJ
                  </th>
                  <th className="py-2 pr-4">
                    Zusatzpass
                  </th>
                  <th className="py-2 pr-4">
                    JJ Zusatzpass
                  </th>
                  <th className="py-2 text-right">
                    Aktion
                  </th>
                </tr>
              </thead>

              <tbody>
                {stitches.map((stitch) => {
                  const draft =
                    stitchDrafts[stitch.id];

                  return (
                    <tr
                      key={stitch.id}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="py-3 pr-4 font-semibold">
                        {stitch.name}
                      </td>

                      {[
                        ["standard", "Standardpreis"],
                        ["jj", "JJ-Preis"],
                        ["additional", "Zusatzpass"],
                        ["jjAdditional", "JJ Zusatzpass"],
                      ].map(([field, label]) => (
                        <td
                          key={field}
                          className="py-3 pr-4"
                        >
                          <div className="flex min-w-32 items-center gap-2">
                            <span className="text-slate-500">
                              CHF
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                draft?.[
                                  field as keyof typeof draft
                                ] ?? ""
                              }
                              onChange={(event) =>
                                setStitchDrafts(
                                  (current) => ({
                                    ...current,
                                    [stitch.id]: {
                                      ...current[
                                        stitch.id
                                      ],
                                      [field]:
                                        event.target
                                          .value,
                                    },
                                  })
                                )
                              }
                              className="form-input"
                              placeholder={
                                field === "jj" ||
                                field ===
                                  "jjAdditional"
                                  ? "Standard"
                                  : "0.00"
                              }
                              aria-label={label}
                            />
                          </div>
                        </td>
                      ))}

                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void saveStitchPricing(
                              stitch.id
                            )
                          }
                          className="rounded-lg border px-3 py-2 font-semibold text-slate-700"
                        >
                          Speichern
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Einnahmen total
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {money(totalRevenue)}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Teilnehmer mit Einnahmen
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {participantSummary.length}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Gelöste Stiche
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {revenueRows.length}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Einnahmen nach Stich
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">
                    Stich
                  </th>
                  <th className="py-2 pr-4 text-right">
                    Gelöst
                  </th>
                  <th className="py-2 pr-4 text-right">
                    Passen
                  </th>
                  <th className="py-2 pr-4 text-right">Einnahmen</th>
                  <th className="py-2 pr-4 text-right">Sofortauszahlungen</th>
                  <th className="py-2 pr-4 text-right">Zur Verfügung</th>
                  <th className="py-2 pr-4 text-right">Quote</th>
                  <th className="py-2 text-right">Auszahlung</th>
                </tr>
              </thead>

              <tbody>
                {stitchSummary.map((entry) => (
                  <tr
                    key={entry.stitch.id}
                    className="border-b border-slate-100"
                  >
                    <td className="py-3 pr-4 font-semibold text-slate-900">
                      {entry.stitch.name}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {entry.registrations}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {entry.passes}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">{money(entry.revenue)}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{money(entry.instant)}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{money(entry.available)}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{entry.quotePercentage.toFixed(2)} %</td>
                    <td className="py-3 text-right font-semibold">{money(entry.ranking)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Einzelliste Auszahlungen</h2>
              <p className="mt-1 text-sm text-slate-500">
                Pro Schütze und Stich: Sofortauszahlung, Rang und Rangauszahlung.
              </p>
            </div>
            <button
              type="button"
              onClick={exportPayoutDetailsCsv}
              disabled={payoutData.openRows.length === 0}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Einzelliste CSV exportieren
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">SB</th>
                  <th className="py-2 pr-4">Schütze</th>
                  <th className="py-2 pr-4">Stich</th>
                  <th className="py-2 pr-4 text-right">Rang</th>
                  <th className="py-2 pr-4 text-right">Sofort</th>
                  <th className="py-2 pr-4 text-right">Rangpreis</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {payoutData.openRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-5 text-slate-500">
                      Noch keine Auszahlungen vorhanden.
                    </td>
                  </tr>
                ) : (
                  payoutData.openRows
                    .slice()
                    .sort((a, b) =>
                      (a.startNumber ?? 999999) - (b.startNumber ?? 999999) ||
                      a.stitchName.localeCompare(b.stitchName, "de-CH")
                    )
                    .map((row) => (
                      <tr
                        key={`${row.registrationId}-${row.stitchId}`}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3 pr-4">{row.startNumber ?? "–"}</td>
                        <td className="py-3 pr-4 font-semibold">{row.shooterName}</td>
                        <td className="py-3 pr-4">{row.stitchName}</td>
                        <td className="py-3 pr-4 text-right">{row.rank ?? "–"}</td>
                        <td className="py-3 pr-4 text-right">{money(row.instant)}</td>
                        <td className="py-3 pr-4 text-right">{money(row.ranking)}</td>
                        <td className="py-3 text-right font-bold">{money(row.total)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Einnahmen nach Teilnehmer
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">
                    SB
                  </th>
                  <th className="py-2 pr-4">
                    Schütze
                  </th>
                  <th className="py-2 text-right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {participantSummary.map((entry) => (
                  <tr
                    key={entry.registrationId}
                    className="border-b border-slate-100"
                  >
                    <td className="py-3 pr-4 font-semibold">
                      {entry.startNumber ?? "–"}
                    </td>
                    <td className="py-3 pr-4">
                      {entry.shooterName}
                    </td>
                    <td className="py-3 text-right font-semibold">
                      {money(entry.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Detail & individuelle Preise
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ein individueller Preis hat Vorrang vor JJ- und Standardpreis. Leer bedeutet automatisch berechnen.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">SB</th>
                  <th className="py-2 pr-4">Schütze</th>
                  <th className="py-2 pr-4">Kat.</th>
                  <th className="py-2 pr-4">Stich</th>
                  <th className="py-2 pr-4">Preisquelle</th>
                  <th className="py-2 pr-4 text-right">Berechnet</th>
                  <th className="py-2 pr-4">Indiv. Grundpreis</th>
                  <th className="py-2 pr-4">Indiv. Zusatzpass</th>
                  <th className="py-2 text-right">Aktion</th>
                </tr>
              </thead>

              <tbody>
                {revenueRows.map((row) => {
                  const draft =
                    overrideDrafts[
                      row.registrationStitchId
                    ];

                  return (
                    <tr
                      key={row.registrationStitchId}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="py-3 pr-4 font-semibold">
                        {row.startNumber ?? "–"}
                      </td>
                      <td className="py-3 pr-4">
                        {row.shooterName}
                      </td>
                      <td className="py-3 pr-4">
                        {row.category}
                      </td>
                      <td className="py-3 pr-4">
                        {row.stitchName}
                      </td>
                      <td className="py-3 pr-4">
                        {row.priceSource}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="font-semibold">
                          {money(row.total)}
                        </div>
                        {row.additionalPasses > 0 && (
                          <div className="mt-1 text-xs text-slate-500">
                            {money(row.basePrice)} +{" "}
                            {row.additionalPasses} ×{" "}
                            {money(
                              row.additionalPassPrice
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 pr-4">
                        <div className="flex min-w-32 items-center gap-2">
                          <span className="text-slate-500">
                            CHF
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft?.base ?? ""}
                            onChange={(event) =>
                              setOverrideDrafts(
                                (current) => ({
                                  ...current,
                                  [row.registrationStitchId]:
                                    {
                                      ...current[
                                        row
                                          .registrationStitchId
                                      ],
                                      base:
                                        event.target.value,
                                    },
                                })
                              )
                            }
                            className="form-input"
                            placeholder="Auto"
                          />
                        </div>
                      </td>

                      <td className="py-3 pr-4">
                        <div className="flex min-w-32 items-center gap-2">
                          <span className="text-slate-500">
                            CHF
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              draft?.additional ?? ""
                            }
                            onChange={(event) =>
                              setOverrideDrafts(
                                (current) => ({
                                  ...current,
                                  [row.registrationStitchId]:
                                    {
                                      ...current[
                                        row
                                          .registrationStitchId
                                      ],
                                      additional:
                                        event.target.value,
                                    },
                                })
                              )
                            }
                            className="form-input"
                            placeholder="Auto"
                          />
                        </div>
                      </td>

                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void saveOverride(
                              row.registrationStitchId
                            )
                          }
                          className="rounded-lg border px-3 py-2 font-semibold text-slate-700"
                        >
                          Speichern
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
