// Unit costs measured by real calls in Gate 0.
export const COSTS = { skinTone: 20, tryOn: 1 } as const;

// Budget policy (proposed in Gate 0, adjust here only).
export const CAPS = {
  reserveUnits: 250, // never spent: final demo, video retakes, judges
  liveBudgetUnits: 600, // total for live public sessions
  dailyUnits: 100, // per-day cap for live sessions
  maxTryOnsPerSession: 3,
  defaultTryOnsPerSession: 1,
} as const;

export function sessionCost(tryOns: number): number {
  const n = Math.min(Math.max(Math.floor(tryOns), 0), CAPS.maxTryOnsPerSession);
  return COSTS.skinTone + n * COSTS.tryOn;
}

export const MAX_UNITS_PER_SESSION = sessionCost(CAPS.maxTryOnsPerSession);
