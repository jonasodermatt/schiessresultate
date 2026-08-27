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

type DailyResult = {
  id: string;
  date: string;
  actual_shots: number;
  total_score: number;
  average_score: number;
  result_count: number;
};

function getLocalDateKey(date: string) {
  const value = new Date(date);

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function PerformanceChart({
  results,
}: PerformanceChartProps) {
  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const dailyResults = useMemo(() => {
    const days = new Map<
      string,
      {
        date: string;
        actual_shots: number;
        total_score: number;
        result_count: number;
      }
    >();

    for (const result of results) {
      const key = getLocalDateKey(result.date);

      const current = days.get(key) ?? {
        date: result.date,
        actual_shots: 0,
        total_score: 0,
        result_count: 0,
      };

      current.actual_shots += Number(result.actual_shots);
      current.total_score += Number(result.total_score);
      current.result_count += 1;

      if (
        new Date(result.date).getTime() <
        new Date(current.date).getTime()
      ) {
        current.date = result.date;
      }

      days.set(key, current);
    }

    return Array.from(days.entries())
      .map(([key, day]) => ({
        id: key,
        date: day.date,
        actual_shots: day.actual_shots,
        total_score: day.total_score,
        average_score:
          day.actual_shots > 0
            ? day.total_score / day.actual_shots
            : 0,
        result_count: day.result_count,
      }))
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      ) as DailyResult[];
  }, [results]);

  if (dailyResults.length === 0) {
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
    ...dailyResults.map((result) =>
      Number(result.actual_shots)
    ),
    1
  );

  const shotScaleValues = Array.from(
    new Set([
      0,
      Math.round(maxShots * 0.25),
      Math.round(maxShots * 0.5),
      Math.round(maxShots * 0.75),
      maxShots,
    ])
  );

  const maxAverage = Math.max(
    10,
    ...dailyResults.map((result) =>
      Number(result.average_score)
    )
  );

  const xForIndex = (index: number) => {
    if (dailyResults.length === 1) {
      return paddingLeft + chartWidth / 2;
    }

    return (
      paddingLeft +
      (index / (dailyResults.length - 1)) *
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
    dailyResults.find(
      (result) => result.id === selectedId
    ) ?? null;

  const linePoints = dailyResults
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
          Gewichteter Durchschnitt pro Schuss und Anzahl
          Schüsse pro Trainingstag.
        </p>
      </div>

      {selectedResult && (
        <div className="mt-5 rounded-xl bg-slate-100 p-4">
          <p className="font-semibold text-slate-900">
            {formatDate(selectedResult.date)}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
            <span>
              Ø {Number(selectedResult.average_score).toFixed(2)}
            </span>

            <span>
              {selectedResult.actual_shots} Schüsse
            </span>

            <span>
              Total {Number(selectedResult.total_score).toFixed(0)}
            </span>

            <span>
              {selectedResult.result_count} {selectedResult.result_count === 1 ? "Resultat" : "Resultate"}
            </span>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[700px] w-full"
          role="img"
          aria-label="Leistungsentwicklung nach Trainingstag"
        >
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

          {dailyResults.map((result, index) => {
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

          {dailyResults.length > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="#dc2626"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {dailyResults.map((result, index) => {
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

          {dailyResults.map((result, index) => {
            const maxLabels = 8;

            const labelStep = Math.max(
              1,
              Math.ceil(
                dailyResults.length / maxLabels
              )
            );

            const isFirst = index === 0;
            const isLast =
              index === dailyResults.length - 1;

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
        <div
          className="flex items-center gap-3"
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
          <span>
            Gewichteter Durchschnitt pro Schuss
          </span>
        </div>

        <div
          className="flex items-center gap-3"
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
          <span>
            Anzahl Schüsse pro Trainingstag
          </span>
        </div>
      </div>

      <p
        className="mt-3 text-xs text-slate-500"
        style={{ marginLeft: "24px" }}
      >
        Tippe auf einen roten Punkt, um die
        Tageswerte anzuzeigen.
      </p>
    </div>
  );
}
