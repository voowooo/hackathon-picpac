export function postcardShowsBack(yaw: number): boolean {
  const angle = ((yaw % 360) + 360) % 360;
  return angle > 90 && angle < 270;
}

// Always finish face-on, including when the gesture ends exactly on an edge.
export function snapPostcardYaw(yaw: number): number {
  return Number.isFinite(yaw) ? Math.round(yaw / 180) * 180 : 0;
}
