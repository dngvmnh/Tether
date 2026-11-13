/** Equivalent retention-duration keys observed in model output and old caches. */
const ATTRIBUTE_ALIASES = new Map([
  ['log.retention', 'logs.retention'],
  ['log.retention.duration', 'logs.retention'],
  ['logs.retention.duration', 'logs.retention'],
]);

export function canonicalAttribute(attribute: string): string {
  return ATTRIBUTE_ALIASES.get(attribute) ?? attribute;
}
