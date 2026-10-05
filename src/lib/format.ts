/** 75 -> "1:15"; 3725 -> "1:02:05". */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg == null) return '-';
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

export function formatDate(ms: number): string {
  return dateFmt.format(new Date(ms));
}
