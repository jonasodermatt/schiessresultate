"use client";

import { useId, useMemo } from "react";
import {
  CROSSBOW_10M_TARGET, CROSSBOW_30M_TARGET,
  RIFLE_10M_TARGET, RIFLE_50M_TARGET, RIFLE_300M_TARGET,
  type TargetType,
} from  "@/components/Target";;
import { averageOf, dailySeries, densityOf, type ScoredResult, type Position, type ScoringType } from "./statistics-data";

function averageScale(values: number[], maximum: number) {
  const valid = values.filter(Number.isFinite);
  const min = valid.reduce((a, b) => Math.min(a, b), valid[0] ?? 0);
  const max = valid.reduce((a, b) => Math.max(a, b), valid[0] ?? 0);
  const padding = Math.max((max - min) * 0.15, maximum === 100 ? 0.2 : 0.05);
  const desiredLow = Math.max(0, min - padding);
  const desiredHigh = Math.min(Math.max(maximum, max), max + padding);
  const rawStep = Math.max(desiredHigh - desiredLow, 0.2) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1, 2, 2.5, 5, 10].find((value) => value * magnitude >= rawStep) ?? 10) * magnitude;
  const low = Number(Math.max(0, Math.floor((desiredLow + 1e-10) / step) * step).toFixed(6));
  const high = Number(Math.max(low + step, Math.min(Math.max(maximum, max), Math.ceil((desiredHigh - 1e-10) / step) * step)).toFixed(6));
  const ticks: number[] = [];
  for (let value = low; value <= high + step * 1e-6; value += step) ticks.push(Number(value.toFixed(6)));
  if (high - ticks[ticks.length - 1] > step * 1e-6) ticks.push(Number(high.toFixed(6)));
  return { low, high, ticks };
}

const number = (value: number) => value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (time: number) => new Date(time).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function StatisticsPerformance({ results, scoringType }: { results: ScoredResult[]; scoringType: ScoringType }) {
  const days = useMemo(() => dailySeries(results), [results]);
  const overall = useMemo(() => averageOf(results), [results]);
  const titleId = useId();
  if (!days.length || overall === null) return null;
  const maximum = scoringType === "A100" ? 100 : scoringType === "A5" ? 5 : 10;
  const values = days.map((day) => day.average);
  const { low, high, ticks } = averageScale([...values, overall], maximum);
  const first = days[0].time;
  const last = days[days.length - 1].time;
  const x = (time: number) => first === last ? 410 : 65 + (time - first) / (last - first) * 675;
  const y = (value: number) => 240 - (value - low) / (high - low) * 205;
  const dayLine = days.map((day) => `${x(day.time)},${y(day.average)}`).join(" ");
  const label = "Gesamtdurchschnitt";
  const dateIndices = [...new Set(Array.from({ length: Math.min(days.length, 5) }, (_, i) => Math.round(i * (days.length - 1) / Math.max(1, Math.min(days.length, 5) - 1))))];
  return (
    <div className="rounded-2xl border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Entwicklung</h2>
          <p className="mt-1 text-sm text-slate-500">{scoringType} · Punkte pro Schuss · aktuelle Filterauswahl</p>
        </div>

      </div>
      <div className="mt-5 flex flex-wrap gap-5 text-sm">
        <span className="text-red-600">━ Tagesdurchschnitt</span>
        <span className="text-blue-700">┄ {label}</span>
        <span className="text-slate-600">Ø Zeitraum: {number(overall)}</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox="0 0 780 295" className="w-full" style={{ minWidth: 580 }} role="img" aria-labelledby={titleId}>
          <title id={titleId}>{`Tagesdurchschnitt und ${label}, nach Anzahl Schüssen gewichtet`}</title>
          {ticks.map((value) => {
            return <g key={value}>
              <line x1="65" x2="740" y1={y(value)} y2={y(value)} stroke="#e2e8f0" />
              <text x="55" y={y(value) + 4} textAnchor="end" fontSize="12" fill="#64748b">{number(value)}</text>
            </g>;
          })}
          {dateIndices.map((index) => <text key={index} x={x(days[index].time)} y="268" textAnchor="middle" fontSize="12" fill="#64748b">{dateLabel(days[index].time)}</text>)}
          <polyline points={dayLine} fill="none" stroke="#dc2626" strokeWidth="2.5" />
          <line x1="65" x2="740" y1={y(overall)} y2={y(overall)} stroke="#1d4ed8" strokeWidth="2.5" strokeDasharray="7 5" />
          {days.map((day) => <g key={day.day}>
            <circle cx={x(day.time)} cy={y(day.average)} r="4" fill="#dc2626" stroke="white">
              <title>{`${dateLabel(day.time)}: Tages-Ø ${number(day.average)} · ${day.shots} Schüsse`}</title>
            </circle>

          </g>)}
        </svg>
      </div>
      <p className="text-sm text-slate-500">Die blaue Linie zeigt den Durchschnitt aller Schüsse im gewählten Zeitraum. Jeder Schuss zählt gleich viel. Die Punkteachse passt sich den Werten an und beginnt nicht zwingend bei null.</p>
      {days.length === 1 && <p className="mt-2 text-sm text-slate-500">Für einen Verlauf braucht es Resultate an mindestens zwei Tagen.</p>}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-slate-600">Tageswerte anzeigen</summary>
        <div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left text-slate-700">
          <thead><tr><th className="p-2">Datum</th><th className="p-2">Schüsse</th><th className="p-2">Tages-Ø</th></tr></thead>
          <tbody>{days.map((day) => <tr key={day.day} className="border-t"><td className="p-2">{dateLabel(day.time)}</td><td className="p-2">{day.shots}</td><td className="p-2">{number(day.average)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </div>
  );
}

export type TendencyGroup = { key: string; title: string; targetType: TargetType; shots: Position[] };

function TendencyTarget({ group }: { group: TendencyGroup }) {
  const density = useMemo(() => densityOf(group.shots), [group.shots]);
  const clipId = useId();
  const titleId = useId();
  if (!density) return null;
  const definition = group.targetType === "rifle10m" ? RIFLE_10M_TARGET
    : group.targetType === "rifle50m" ? RIFLE_50M_TARGET
    : group.targetType === "rifle300m" ? RIFLE_300M_TARGET
    : group.targetType === "crossbow10m" ? CROSSBOW_10M_TARGET
    : group.targetType === "crossbow30m" ? CROSSBOW_30M_TARGET : null;
  const scale = 132 / density.extent;
  const radius = (ring: number) => definition
    ? (definition.tenDiameterMm / 2 + (10 - ring) * definition.ringWidthMm) / (definition.targetSizeMm / 2) * scale
    : (11 - ring) * 0.09 * scale;
  const meanX = 160 + density.meanX * scale;
  const meanY = 160 - density.meanY * scale;
  const step = 264 / density.size;
  const offset = (value: number, negative: string, positive: string) => {
    const amount = Math.abs(value) * (definition ? definition.targetSizeMm / 2 : 100);
    if (amount < 0.05) return "zentriert";
    return `${amount.toFixed(1)} ${definition ? "mm" : "% des Scheibenradius"} ${value < 0 ? negative : positive}`;
  };
  return <article className="rounded-xl border border-slate-200 p-4">
    <h3 className="font-semibold text-slate-900">{group.title}</h3>
    <p className="mt-1 text-sm text-slate-500">{density.count} Treffer mit Position</p>
    <svg viewBox="0 0 320 320" className="mx-auto mt-3 w-full max-w-sm" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{`${group.title}: Trefferdichte. Mittlere Lage: ${offset(density.meanX, "links", "rechts")}, ${offset(density.meanY, "tief", "hoch")}`}</title>
      <defs><clipPath id={clipId}><rect x="28" y="28" width="264" height="264" /></clipPath></defs>
      <rect x="28" y="28" width="264" height="264" fill="#f8fafc" stroke="#cbd5e1" />
      <g clipPath={`url(#${clipId})`}>
        {definition && <circle cx="160" cy="160" r={definition.blackDiameterMm / definition.targetSizeMm * scale} fill="#e2e8f0" />}
        {density.cells.map((value, index) => value / density.peak < 0.025 ? null :
          <rect key={index} x={28 + index % density.size * step} y={28 + Math.floor(index / density.size) * step}
            width={step + 0.1} height={step + 0.1} fill={`hsl(${45 * (1 - value / density.peak)}, 90%, 50%)`} opacity={0.15 + 0.7 * value / density.peak} />)}
        {Array.from({ length: 10 }, (_, i) => i + 1).map((ring) => <circle key={ring} cx="160" cy="160" r={radius(ring)} fill="none" stroke="#64748b" strokeWidth="0.7" opacity="0.7" />)}
        <path d="M150 160H170 M160 150V170" stroke="#64748b" strokeWidth="1" />
        <path d={`M${meanX - 7} ${meanY}H${meanX + 7} M${meanX} ${meanY - 7}V${meanY + 7}`} stroke="white" strokeWidth="5" />
        <path d={`M${meanX - 7} ${meanY}H${meanX + 7} M${meanX} ${meanY - 7}V${meanY + 7}`} stroke="#0f172a" strokeWidth="2" />
      </g>
      <text x="160" y="18" textAnchor="middle" fontSize="11" fill="#64748b">hoch</text>
      <text x="160" y="309" textAnchor="middle" fontSize="11" fill="#64748b">tief</text>
      <text x="16" y="160" textAnchor="middle" fontSize="11" fill="#64748b" transform="rotate(-90 16 160)">links</text>
      <text x="307" y="160" textAnchor="middle" fontSize="11" fill="#64748b" transform="rotate(90 307 160)">rechts</text>
    </svg>
    <p className="text-sm font-medium text-slate-800">Mittlere Lage: {offset(density.meanX, "links", "rechts")} · {offset(density.meanY, "tief", "hoch")}</p>
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
      <span>Links: {density.left.toFixed(0)} %</span><span>Rechts: {density.right.toFixed(0)} %</span>
      <span>Hoch: {density.above.toFixed(0)} %</span><span>Tief: {density.below.toFixed(0)} %</span>
    </div>
    <p className="mt-3 text-xs text-slate-500">Automatischer Ausschnitt · {definition ? `${(density.extent * definition.targetSizeMm).toFixed(1)} mm` : `${(density.extent * 100).toFixed(0)} % der Scheibenbreite`} · Treffer genau auf einer Achse zählen für diese Achse zu keiner Seite.</p>
    {density.count < 5 && <p className="mt-2 text-sm text-amber-700">Noch wenige Treffer – die Tendenz ist vorläufig.</p>}
  </article>;
}

export function StatisticsTendencies({ groups, totalShots }: { groups: TendencyGroup[]; totalShots: number }) {
  const positioned = groups.reduce((sum, group) => sum + group.shots.length, 0);
  return <div className="rounded-2xl border bg-white p-5 sm:p-6">
    <h2 className="text-xl font-bold text-slate-900">Treffertendenzen</h2>
    <p className="mt-1 text-sm font-medium text-slate-700">A5, A10 und A100 gemeinsam · gleicher Zeitraum, gleiche Distanz, Stellung und Sportgeräteauswahl</p>
    <p className="mt-2 text-sm text-slate-600">Rot zeigt die Bereiche mit der höchsten Trefferdichte, Gelb die Randbereiche. Das dunkle Kreuz markiert die mittlere Trefferposition.</p>
    <p className="mt-2 text-sm text-slate-500">{positioned} von {totalShots} Schüssen mit auswertbarer Position. Die Dichte wird je Scheibe skaliert; unterschiedliche Scheiben werden getrennt dargestellt.</p>
    {positioned === 0 ? <p className="mt-5 text-slate-500">Für diese Filterauswahl sind keine Trefferpositionen vorhanden. Nur-Total-Resultate und manuell erfasste Punkte liefern keine Trefferlage.</p>
      : <div className="mt-5 grid gap-5 lg:grid-cols-2">{groups.map((group) => <TendencyTarget key={group.key} group={group} />)}</div>}
  </div>;
}
