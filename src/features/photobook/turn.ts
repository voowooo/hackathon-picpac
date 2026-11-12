export type BookSide = "left" | "right";
export type BookLeaf = { page: number; side: BookSide };

export function bookTurnPlan(from: number, to: number) {
  const forward = to > from;
  const source: BookSide = forward ? "right" : "left";
  const destination: BookSide = forward ? "left" : "right";
  const leaf = (page: number, side: BookSide): BookLeaf | null => page === 0 && side === "left" ? null : { page, side };
  return {
    forward,
    // The incoming stationary half is completely covered at the first frame.
    stationary: [leaf(from, destination), leaf(to, source)].filter((item): item is BookLeaf => item !== null),
    front: leaf(from, source),
    back: leaf(to, destination),
  };
}
