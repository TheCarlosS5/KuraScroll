const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function naturalSort(items: string[]): string[] {
  return [...items].sort((a, b) => collator.compare(a, b));
}
