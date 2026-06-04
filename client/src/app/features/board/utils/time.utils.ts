/** Parse Jira-style durations such as `2h`, `30m`, `1h 30m`, or `1d` (1d = 8h). */
export function parseDurationToMinutes(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const minutes = Number(trimmed);
    return minutes > 0 && minutes <= 599_940 ? minutes : null;
  }

  const normalized = trimmed.replace(/\s+/g, '');
  let total = 0;
  let matched = false;
  for (const match of normalized.matchAll(/(\d+(?:\.\d+)?)([dhm])/g)) {
    matched = true;
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === 'd') total += amount * 480;
    else if (unit === 'h') total += amount * 60;
    else total += amount;
  }

  if (!matched || total <= 0 || total > 599_940) return null;
  return Math.round(total);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '';
  let remaining = minutes;
  const days = Math.floor(remaining / 480);
  remaining %= 480;
  const hours = Math.floor(remaining / 60);
  remaining %= 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (remaining || !parts.length) parts.push(`${remaining}m`);
  return parts.join(' ');
}

export function remainingMinutes(estimate: number | null | undefined, spent: number): number | null {
  if (estimate == null) return null;
  return estimate - spent;
}
