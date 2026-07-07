export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatHours(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${(Math.round(h * 10) / 10).toLocaleString()} h`;
}
