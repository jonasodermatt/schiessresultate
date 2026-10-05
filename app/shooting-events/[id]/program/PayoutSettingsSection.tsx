"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Props = {
  supabase: SupabaseClient;
  stitchId: string;
  stitchPriceChf?: number;
  participantCount?: number;
  onSaved?: () => void;
};

type Rule = {
  id?: string;
  score: string;
  firstAmountChf: string;
  repeatAmountChf: string;
};

type Settings = {
  enabled: boolean;
  payoutPercentage: string;
  winnerMode: "fraction" | "fixed" | "all";
  winnerNumerator: string;
  winnerDenominator: string;
  fixedWinnerCount: string;
  minimumFirst: string;
  minimumSecond: string;
  minimumThird: string;
  minimumLast: string;
  payoutStep: string;
  curveExponent: string;
  instantPayoutMax: string;
};

const defaultSettings: Settings = {
  enabled: false,
  payoutPercentage: "60",
  winnerMode: "fraction",
  winnerNumerator: "2",
  winnerDenominator: "3",
  fixedWinnerCount: "",
  minimumFirst: "",
  minimumSecond: "",
  minimumThird: "",
  minimumLast: "",
  payoutStep: "1.00",
  curveExponent: "0.6",
  instantPayoutMax: "",
};

function nullableNumber(value: string) {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function PayoutSettingsSection({
  supabase,
  stitchId,
  stitchPriceChf = 0,
  participantCount = 0,
  onSaved,
}: Props) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage("");

      const [stitchResult, rulesResult] = await Promise.all([
        supabase
          .from("shooting_event_stitches")
          .select(
            "payout_enabled, payout_percentage, payout_winner_mode, payout_winner_numerator, payout_winner_denominator, payout_fixed_winner_count, payout_min_first_chf, payout_min_second_chf, payout_min_third_chf, payout_min_last_chf, payout_step_chf, payout_curve_exponent, payout_instant_max_chf"
          )
          .eq("id", stitchId)
          .single(),
        supabase
          .from("shooting_event_stitch_instant_payout_rules")
          .select("id, score, first_amount_chf, repeat_amount_chf")
          .eq("event_stitch_id", stitchId)
          .order("score", { ascending: false }),
      ]);

      if (stitchResult.error) {
        setMessage(`Auszahlungen konnten nicht geladen werden: ${stitchResult.error.message}`);
        setLoading(false);
        return;
      }

      const row = stitchResult.data;
      setSettings({
        enabled: Boolean(row.payout_enabled),
        payoutPercentage: String(row.payout_percentage ?? 60),
        winnerMode: (row.payout_winner_mode ?? "fraction") as Settings["winnerMode"],
        winnerNumerator: String(row.payout_winner_numerator ?? 2),
        winnerDenominator: String(row.payout_winner_denominator ?? 3),
        fixedWinnerCount: row.payout_fixed_winner_count == null ? "" : String(row.payout_fixed_winner_count),
        minimumFirst: row.payout_min_first_chf == null ? "" : String(row.payout_min_first_chf),
        minimumSecond: row.payout_min_second_chf == null ? "" : String(row.payout_min_second_chf),
        minimumThird: row.payout_min_third_chf == null ? "" : String(row.payout_min_third_chf),
        minimumLast: row.payout_min_last_chf == null ? "" : String(row.payout_min_last_chf),
        payoutStep: Number(row.payout_step_chf ?? 1).toFixed(2),
        curveExponent: String(row.payout_curve_exponent ?? 0.6),
        instantPayoutMax: row.payout_instant_max_chf == null ? "" : Number(row.payout_instant_max_chf).toFixed(2),
      });

      if (rulesResult.error) {
        setMessage(`Sofortauszahlungen konnten nicht geladen werden: ${rulesResult.error.message}`);
        setLoading(false);
        return;
      }

      setRules(
        (rulesResult.data ?? []).map((rule) => ({
          id: rule.id,
          score: String(rule.score),
          firstAmountChf: Number(rule.first_amount_chf ?? 0).toFixed(2),
          repeatAmountChf: Number(rule.repeat_amount_chf ?? 0).toFixed(2),
        }))
      );
      setLoading(false);
    }

    void load();
  }, [stitchId, supabase]);

  const preview = useMemo(() => {
    const percentage = Number(settings.payoutPercentage) || 0;
    const income = participantCount * stitchPriceChf;
    const grossPool = income * (percentage / 100);
    const winnerCount =
      settings.winnerMode === "all"
        ? participantCount
        : settings.winnerMode === "fixed"
          ? Math.min(participantCount, Number(settings.fixedWinnerCount) || 0)
          : Math.floor(
              (participantCount * (Number(settings.winnerNumerator) || 0)) /
                Math.max(1, Number(settings.winnerDenominator) || 1)
            );

    return { income, grossPool, winnerCount };
  }, [participantCount, settings, stitchPriceChf]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function addRule() {
    setRules((current) => [
      ...current,
      { score: "100", firstAmountChf: "5.00", repeatAmountChf: "4.00" },
    ]);
  }

  function changeRule(index: number, patch: Partial<Rule>) {
    setRules((current) =>
      current.map((rule, currentIndex) =>
        currentIndex === index ? { ...rule, ...patch } : rule
      )
    );
  }

  function removeRule(index: number) {
    setRules((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function save() {
    const percentage = Number(settings.payoutPercentage);
    const step = Number(settings.payoutStep);
    const numerator = Number(settings.winnerNumerator);
    const denominator = Number(settings.winnerDenominator);
    const instantPayoutMax = nullableNumber(settings.instantPayoutMax);

    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      setMessage("Die Ausschüttungsquote muss zwischen 0 und 100 % liegen.");
      return;
    }

    if (instantPayoutMax !== null && instantPayoutMax < 0) {
      setMessage("Der Maximalbetrag der Sofortauszahlungen darf nicht negativ sein.");
      return;
    }

    if (!Number.isFinite(step) || step <= 0) {
      setMessage("Bitte eine gültige Auszahlungsschrittgrösse wählen.");
      return;
    }

    if (
      settings.winnerMode === "fraction" &&
      (!Number.isInteger(numerator) || numerator < 0 || !Number.isInteger(denominator) || denominator < 1)
    ) {
      setMessage("Bitte einen gültigen Bruch für die Preisberechtigten erfassen.");
      return;
    }

    const normalizedRules = rules.map((rule, index) => ({
      score: Number(rule.score),
      first_amount_chf: Number(rule.firstAmountChf),
      repeat_amount_chf: Number(rule.repeatAmountChf),
      sort_order: index,
    }));

    if (
      normalizedRules.some(
        (rule) =>
          !Number.isFinite(rule.score) ||
          !Number.isFinite(rule.first_amount_chf) ||
          rule.first_amount_chf < 0 ||
          !Number.isFinite(rule.repeat_amount_chf) ||
          rule.repeat_amount_chf < 0
      )
    ) {
      setMessage("Bitte die Sofortauszahlungen vollständig und gültig erfassen.");
      return;
    }

    const scores = new Set<number>();
    for (const rule of normalizedRules) {
      if (scores.has(rule.score)) {
        setMessage(`Treffer ${rule.score} ist doppelt vorhanden.`);
        return;
      }
      scores.add(rule.score);
    }

    setSaving(true);
    setMessage("");

    try {
      const { error: stitchError } = await supabase
        .from("shooting_event_stitches")
        .update({
          payout_enabled: settings.enabled,
          payout_percentage: percentage,
          payout_winner_mode: settings.winnerMode,
          payout_winner_numerator: settings.winnerMode === "fraction" ? numerator : 2,
          payout_winner_denominator: settings.winnerMode === "fraction" ? denominator : 3,
          payout_fixed_winner_count:
            settings.winnerMode === "fixed" ? nullableNumber(settings.fixedWinnerCount) : null,
          payout_min_first_chf: nullableNumber(settings.minimumFirst),
          payout_min_second_chf: nullableNumber(settings.minimumSecond),
          payout_min_third_chf: nullableNumber(settings.minimumThird),
          payout_min_last_chf: nullableNumber(settings.minimumLast),
          payout_step_chf: step,
          payout_curve_exponent: Number(settings.curveExponent) || 0.6,
          payout_instant_max_chf: instantPayoutMax,
        })
        .eq("id", stitchId);

      if (stitchError) throw new Error(stitchError.message);

      const { error: deleteError } = await supabase
        .from("shooting_event_stitch_instant_payout_rules")
        .delete()
        .eq("event_stitch_id", stitchId);

      if (deleteError) throw new Error(deleteError.message);

      if (normalizedRules.length > 0) {
        const { error: rulesError } = await supabase
          .from("shooting_event_stitch_instant_payout_rules")
          .insert(
            normalizedRules.map((rule) => ({
              event_stitch_id: stitchId,
              ...rule,
            }))
          );

        if (rulesError) throw new Error(rulesError.message);
      }

      setMessage("Auszahlungseinstellungen gespeichert.");
      onSaved?.();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Auszahlungen konnten nicht gespeichert werden: ${error.message}`
          : "Auszahlungen konnten nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border p-5 text-sm text-slate-500">Auszahlungen werden geladen...</div>;
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const labelClass = "text-sm font-semibold text-slate-700";

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Auszahlungen</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sofortpreise und Rangpreis-Verteilung für diesen Stich.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
          />
          Aktiv
        </label>
      </div>

      <div className="mt-6 border-t pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Sofortauszahlungen</h3>
            <p className="mt-1 text-sm text-slate-500">
              Pro Schütze: erster Treffer eines Resultats mit eigenem Betrag, ab dem zweiten Treffer gilt der Wiederholungsbetrag.
            </p>
          </div>
          <button type="button" onClick={addRule} className="rounded-lg border px-3 py-2 text-sm font-semibold">
            + Regel
          </button>
        </div>

        <div className="mt-4 max-w-sm">
          <label className={labelClass}>
            Max. Sofortauszahlung je Schütze und Stich CHF
            <input
              className={inputClass}
              value={settings.instantPayoutMax}
              onChange={(e) => update("instantPayoutMax", e.target.value)}
              inputMode="decimal"
              placeholder="optional / unbegrenzt"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Optional. Sobald ein Schütze diesen Betrag in diesem Stich erreicht hat, erhält er keine weiteren Sofortauszahlungen.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {rules.length === 0 && (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Keine Sofortauszahlungen definiert.</p>
          )}
          {rules.map((rule, index) => (
            <div key={`${rule.id ?? "new"}-${index}`} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <label className={labelClass}>
                Treffer
                <input className={inputClass} value={rule.score} onChange={(e) => changeRule(index, { score: e.target.value })} inputMode="decimal" />
              </label>
              <label className={labelClass}>
                1. Mal CHF
                <input className={inputClass} value={rule.firstAmountChf} onChange={(e) => changeRule(index, { firstAmountChf: e.target.value })} inputMode="decimal" />
              </label>
              <label className={labelClass}>
                Ab 2. Mal CHF
                <input className={inputClass} value={rule.repeatAmountChf} onChange={(e) => changeRule(index, { repeatAmountChf: e.target.value })} inputMode="decimal" />
              </label>
              <button type="button" onClick={() => removeRule(index)} className="self-end rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">
                Entfernen
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t pt-6">
        <h3 className="font-bold text-slate-900">Rangauszahlung</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>
            Ausschüttungsquote (%)
            <input className={inputClass} value={settings.payoutPercentage} onChange={(e) => update("payoutPercentage", e.target.value)} inputMode="decimal" />
          </label>

          <label className={labelClass}>
            Preisberechtigte
            <select className={inputClass} value={settings.winnerMode} onChange={(e) => update("winnerMode", e.target.value as Settings["winnerMode"])}>
              <option value="fraction">Anteil</option>
              <option value="fixed">Feste Anzahl</option>
              <option value="all">Alle</option>
            </select>
          </label>

          {settings.winnerMode === "fraction" && (
            <div className="grid grid-cols-2 gap-2">
              <label className={labelClass}>
                Zähler
                <input className={inputClass} value={settings.winnerNumerator} onChange={(e) => update("winnerNumerator", e.target.value)} inputMode="numeric" />
              </label>
              <label className={labelClass}>
                Nenner
                <input className={inputClass} value={settings.winnerDenominator} onChange={(e) => update("winnerDenominator", e.target.value)} inputMode="numeric" />
              </label>
            </div>
          )}

          {settings.winnerMode === "fixed" && (
            <label className={labelClass}>
              Anzahl Preisränge
              <input className={inputClass} value={settings.fixedWinnerCount} onChange={(e) => update("fixedWinnerCount", e.target.value)} inputMode="numeric" />
            </label>
          )}

          <label className={labelClass}>Mindestpreis 1. Rang CHF<input className={inputClass} value={settings.minimumFirst} onChange={(e) => update("minimumFirst", e.target.value)} inputMode="decimal" placeholder="optional" /></label>
          <label className={labelClass}>Mindestpreis 2. Rang CHF<input className={inputClass} value={settings.minimumSecond} onChange={(e) => update("minimumSecond", e.target.value)} inputMode="decimal" placeholder="optional" /></label>
          <label className={labelClass}>Mindestpreis 3. Rang CHF<input className={inputClass} value={settings.minimumThird} onChange={(e) => update("minimumThird", e.target.value)} inputMode="decimal" placeholder="optional" /></label>
          <label className={labelClass}>Mindestpreis letzter Rang CHF<input className={inputClass} value={settings.minimumLast} onChange={(e) => update("minimumLast", e.target.value)} inputMode="decimal" placeholder="optional" /></label>

          <label className={labelClass}>
            Auszahlungsschritt
            <select className={inputClass} value={settings.payoutStep} onChange={(e) => update("payoutStep", e.target.value)}>
              <option value="0.10">CHF 0.10</option>
              <option value="0.50">CHF 0.50</option>
              <option value="1.00">CHF 1.00</option>
              <option value="5.00">CHF 5.00</option>
              <option value="10.00">CHF 10.00</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4">
        <h3 className="font-bold text-slate-900">Vorschau</h3>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><span className="text-slate-500">Einnahmen</span><div className="font-semibold">CHF {preview.income.toFixed(2)}</div></div>
          <div><span className="text-slate-500">Brutto-Preistopf</span><div className="font-semibold">CHF {preview.grossPool.toFixed(2)}</div></div>
          <div><span className="text-slate-500">Preisränge</span><div className="font-semibold">{preview.winnerCount}</div></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Sofortauszahlungen werden bei der definitiven Berechnung vom Brutto-Preistopf abgezogen.
        </p>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          {saving ? "Wird gespeichert..." : "Auszahlungen speichern"}
        </button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </section>
  );
}
