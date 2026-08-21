"use client";

import { useMemo, useState } from "react";

type ChartResult = {
  id: string;
  date: string;
  actual_shots: number;
  total_score: number;
  average_score: number;
};

type PerformanceChartProps = {
  results: ChartResult[];
};

export default function PerformanceChart({
  results,
}: PerformanceChartProps) {
  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const sortedResults = useMemo(() => {
    return [...results].sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );
  }, [results]);

  if (sortedResults.length === 0) {
    return null;
  }

  const width = 800;
  const height = 360;

  const paddingLeft = 55;
  const paddingRight = 60;
  const paddingTop = 30;
  const paddingBottom = 65;

  const chartWidth =
    width - paddingLeft - paddingRight;

  const chartHeight =
    height - paddingTop - paddingBottom;

  const maxShots = Math.max(
    ...sortedResults.map((result) =>
      Number(result.actual_shots)
    ),
    1
  );
  const shotScaleValues = [
  0,
  Math.round(maxShots * 0.25),
  Math.round(maxShots * 0.5),
  Math.round(maxShots * 0.75),
  maxShots,
];

  const maxAverage = Math.max(
    10,
    ...sortedResults.map((result) =>
      Number(result.average_score)
    )
  );

  const xForIndex = (index: number) => {
    if (sortedResults.length === 1) {
      return paddingLeft + chartWidth / 2;
    }

    return (
      paddingLeft +
      (index / (sortedResults.length - 1)) *
        chartWidth
    );
  };

  const yForAverage = (average: number) => {
    return (
      paddingTop +
      chartHeight -
      (average / maxAverage) * chartHeight
    );
  };

  const selectedResult =
    sortedResults.find(
      (result) => result.id === selectedId
    ) ?? null;

  const linePoints = sortedResults
    .map((result, index) => {
      const x = xForIndex(index);
      const y = yForAverage(
        Number(result.average_score)
      );

      return `${x},${y}`;
    })
    .join(" ");

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  }

  function formatShortDate(date: string) {
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(date));
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Leistungsentwicklung
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          Durchschnitt pro Schuss und Anzahl Schüsse pro
          Resultat.
        </p>
      </div>

      {selectedResult && (
        <div className="mt-5 rounded-xl bg-slate-100 p-4">
          <p className="font-semibold text-slate-900">
            {formatDate(selectedResult.date)}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
            <span>
              Ø{" "}
              {Number(
                selectedResult.average_score
              ).toFixed(2)}
            </span>

            <span>
              {selectedResult.actual_shots} Schüsse
            </span>

            <span>
              Total{" "}
              {Number(
                selectedResult.total_score
              ).toFixed(0)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[700px] w-full"
          role="img"
          aria-label="Leistungsentwicklung"
        >
        {/* Rechte Skala = Anzahl Schüsse */}
{shotScaleValues.map((value) => {
  const ratio = value / maxShots;

 const y =
  paddingTop +
  chartHeight -
  ratio * chartHeight;

  return (
    <g key={`shots-${value}`}>
     <text
  x={width - 10}
  y={y + 4}
  textAnchor="end"
  fontSize="12"
  fill="#475569"
>
  {value}
</text>
    </g>
  );
})}
          {/* Horizontale Hilfslinien */}
          {[0, 2, 4, 6, 8, 10].map((value) => {
            const y = yForAverage(value);

            return (
              <g key={value}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

              <text
  x={15}
  y={y + 4}
  textAnchor="start"
  fontSize="12"
  fill="#475569"
>
  {value}
</text>
              </g>
            );
          })}

          {/* Balken = Anzahl Schüsse */}
          {sortedResults.map((result, index) => {
            const x = xForIndex(index);

          const barHeight =
  (Number(result.actual_shots) / maxShots) *
  chartHeight;

            return (
              <rect
                key={`bar-${result.id}`}
                x={x - 12}
                y={
                  paddingTop +
                  chartHeight -
                  barHeight
                }
                width="24"
                height={barHeight}
                rx="4"
                fill="#3b82f6"
              />
            );
          })}

          {/* Durchschnittslinie */}
          {sortedResults.length > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="#dc2626"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Resultatpunkte */}
          {sortedResults.map((result, index) => {
            const x = xForIndex(index);
            const y = yForAverage(
              Number(result.average_score)
            );

            const selected =
              result.id === selectedId;

            return (
              <g
                key={result.id}
                onClick={() =>
                  setSelectedId(
                    selected ? null : result.id
                  )
                }
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={selected ? 8 : 6}
                  fill="#dc2626"
                  stroke="white"
                  strokeWidth="2"
                />

                <circle
                  cx={x}
                  cy={y}
                  r="18"
                  fill="transparent"
                />
              </g>
            );
          })}

          {/* Datumsbeschriftungen */}
          {/* Datumsbeschriftungen */}
{sortedResults.map((result, index) => {
  const maxLabels = 8;

  const labelStep = Math.max(
    1,
    Math.ceil(sortedResults.length / maxLabels)
  );

  const isFirst = index === 0;
  const isLast = index === sortedResults.length - 1;
  const showLabel =
    isFirst ||
    isLast ||
    index % labelStep === 0;

  if (!showLabel) {
    return null;
  }

  const x = xForIndex(index);

  return (
    <text
      key={`date-${result.id}`}
      x={x}
      y={height - 25}
      textAnchor={
        isFirst
          ? "start"
          : isLast
          ? "end"
          : "middle"
      }
      fontSize="11"
      fill="#64748b"
    >
      {formatShortDate(result.date)}
    </text>
  );
})}

          <text
            x="15"
            y="20"
            fontSize="12"
            fontWeight="600"
            fill="#475569"
          >
            Ø
          </text>
          <text
  x={width - paddingRight + 8}
  y={20}
  fontSize="12"
  fontWeight="600"
  fill="#475569"
>
  Anzahl
</text>
        </svg>
      </div>

<div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-700">
    <div className="flex items-center gap-3"
    style={{ marginLeft: "24px" }}
  >
    <span
      style={{
        display: "inline-block",
        width: "12px",
        height: "12px",
        minWidth: "12px",
        borderRadius: "50%",
        backgroundColor: "#dc2626",
      }}
    />
    <span> Durchschnitt pro Schuss</span>
  </div>

  <div className="flex items-center gap-3"
    style={{ marginLeft: "24px" }}
  >

    <span
      style={{
        display: "inline-block",
        width: "14px",
        height: "14px",
        minWidth: "14px",
        borderRadius: "3px",
        backgroundColor: "#3b82f6",
      }}
    />
    <span> Anzahl Schüsse pro Resultat</span>
  </div>
</div>

      <p className="mt-3 text-xs text-slate-500"  
    style={{ marginLeft: "24px" }}
  >
        Tippe auf einen roten Punkt, um das Resultat
        anzuzeigen.
      </p>
    </div>
  );
}