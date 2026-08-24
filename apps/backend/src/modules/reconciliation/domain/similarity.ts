export function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  let previousRow: number[] = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i++) {
    const currentRow: number[] = [i];

    for (let j = 1; j <= right.length; j++) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        (currentRow[j - 1] ?? 0) + 1,
        (previousRow[j] ?? 0) + 1,
        (previousRow[j - 1] ?? 0) + substitutionCost,
      );
    }

    previousRow = currentRow;
  }

  return previousRow[right.length] ?? Math.max(left.length, right.length);
}

export function similarityRatio(left: string, right: string): number {
  if (!left && !right) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);

  if (maxLength === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
}
