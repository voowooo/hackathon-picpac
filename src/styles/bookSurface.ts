export const BOOK_PAGE_RADIUS = 4;
export const BOOK_COVER_RADIUS = 6;

/** The binding is straight; only the outside corners of an open leaf are rounded. */
export function bookLeafCorners(side: 'left' | 'right' | 'cover') {
  return {
    borderTopLeftRadius: side === 'cover' ? BOOK_COVER_RADIUS : side === 'left' ? BOOK_PAGE_RADIUS : 0,
    borderBottomLeftRadius: side === 'cover' ? BOOK_COVER_RADIUS : side === 'left' ? BOOK_PAGE_RADIUS : 0,
    borderTopRightRadius: side === 'cover' ? BOOK_COVER_RADIUS : side === 'right' ? BOOK_PAGE_RADIUS : 0,
    borderBottomRightRadius: side === 'cover' ? BOOK_COVER_RADIUS : side === 'right' ? BOOK_PAGE_RADIUS : 0,
  };
}
