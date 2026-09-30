const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * The characters of a text as a person sees them: an emoji, a rare character (such as 𠮷) or an accented
 * letter counts as one. Cut text only at these boundaries: cutting inside one leaves half a character,
 * which looks broken and which the database refuses.
 */
export function graphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), (part) => part.segment);
}
