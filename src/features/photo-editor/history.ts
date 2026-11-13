export function historyPush<T>(past: T[], current: T, limit = 12): T[] {
  return [...past.slice(-(limit - 1)), current];
}
export function historyMove<T>(from: T[], to: T[], current: T) {
  if (!from.length) return null;
  return { value: from[from.length - 1], from: from.slice(0, -1), to: historyPush(to, current) };
}
