import { PlnError } from './types';

/* ─── Pop suffix helpers ─── */

/** Forward-scan for " N" pop suffix: when space found, check if rest is all digits */
function trimPopSuffix(content: string): {value: string, pop: number} {
  let inString = false;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '"') inString = !inString;
    if (!inString && content[i] === ' ') {
      let allDigits = true;
      for (let j = i + 1; j < content.length; j++) {
        if (content[j] < '0' || content[j] > '9') { allDigits = false; break; }
      }
      if (allDigits && i + 1 < content.length) {
        return {value: content.slice(0, i), pop: parseInt(content.slice(i + 1), 10)};
      }
    }
  }
  return {value: content, pop: 0};
}

/** Validate content after a closing `"` for multi-line string pop suffix.
 *  Returns -1 for invalid content, 0 for empty (no pop), or N for valid " N" suffix. */
function popSuffixAfter(s: string): number {
  if (s.length === 0) return 0;
  if (s[0] !== ' ') return -1;
  if (s.length < 2 || s[1] < '0' || s[1] > '9') return -1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] < '0' || s[i] > '9') return -1;
  }
  return parseInt(s.slice(1), 10);
}


