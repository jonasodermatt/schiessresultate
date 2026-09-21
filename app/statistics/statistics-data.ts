export type ScoringType = "A10" | "A100" | "A5";

export type ScoredResult = {
  id: string;
  date: string;
  actual_shots: number;
  total_score: number;
};

export function validResult(result: ScoredResult) {
  return Number.isFinite(Number(result.total_score)) &&
    Number(result.total_score) >= 0 &&
    Number.isInteger(Number(result.actual_shots)) && Number(result.actual_shots) > 0 &&
    Number.isFinite(new Date(result.date).getTime());
}

export function averageOf(results: ScoredResult[]): number | null {
  const valid = results.filter(validResult);
  const shots = valid.reduce((sum, result) => sum + Number(result.actual_shots), 0);
  return shots ? valid.reduce((sum, result) => sum + Number(result.total_score), 0) / shots : null;
}

export function bestOf<T extends ScoredResult>(results: T[]): T | null {
  return results.filter(validResult).reduce<T | null>((best, result) => {
    if (!best) return result;
    const difference = Number(result.total_score) / Number(result.actual_shots) -
      Number(best.total_score) / Number(best.actual_shots);
    if (difference !== 0) return difference > 0 ? result : best;
    if (Number(result.actual_shots) !== Number(best.actual_shots)) {
      return Number(result.actual_shots) > Number(best.actual_shots) ? result : best;
    }
    return new Date(result.date) > new Date(best.date) ? result : best;
  }, null);
}

export function dailySeries(results: ScoredResult[]) {
  const days = new Map<string, { points: number; shots: number; time: number }>();
  for (const result of results.filter(validResult)) {
    const date = new Date(result.date);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const previous = days.get(day) ?? { points: 0, shots: 0, time: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() };
    previous.points += Number(result.total_score);
    previous.shots += Number(result.actual_shots);
    days.set(day, previous);
  }
  let totalPoints = 0;
  let totalShots = 0;
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => {
    totalPoints += value.points;
    totalShots += value.shots;
    return { day, time: value.time, shots: value.shots, average: value.points / value.shots, cumulative: totalPoints / totalShots };
  });
}

export type Position = { x_position: number | null; y_position: number | null };

export function densityOf(shots: Position[], size = 40) {
  const points = shots.filter((shot) => shot.x_position !== null && shot.y_position !== null &&
    Number.isFinite(Number(shot.x_position)) && Number.isFinite(Number(shot.y_position)) &&
    Math.abs(Number(shot.x_position)) <= 1 && Math.abs(Number(shot.y_position)) <= 1
  ).map((shot) => ({ x: Number(shot.x_position), y: Number(shot.y_position) }));
  if (!points.length) return null;
  // Auto framing keeps a tight group visible; every valid position is included.
  const extent = Math.min(1, Math.max(0.06, points.reduce((max, p) => Math.max(max, Math.abs(p.x), Math.abs(p.y)), 0) * 1.2));
  const bins = Array<number>(size * size).fill(0);
  for (const p of points) {
    const col = Math.max(0, Math.min(size - 1, Math.floor((p.x + extent) / (2 * extent) * size)));
    const row = Math.max(0, Math.min(size - 1, Math.floor((extent - p.y) / (2 * extent) * size)));
    bins[row * size + col]++;
  }
  const cells = bins.map((_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    let value = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const y = row + dy;
        const x = col + dx;
        if (x >= 0 && y >= 0 && x < size && y < size) {
          value += bins[y * size + x] * Math.exp(-(dx * dx + dy * dy) / 3);
        }
      }
    }
    return value;
  });
  const count = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / count;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / count;
  const percent = (test: (p: { x: number; y: number }) => boolean) => 100 * points.filter(test).length / count;
  return { cells, size, extent, count, peak: Math.max(...cells), meanX, meanY,
    left: percent((p) => p.x < 0), right: percent((p) => p.x > 0),
    above: percent((p) => p.y > 0), below: percent((p) => p.y < 0) };
}
