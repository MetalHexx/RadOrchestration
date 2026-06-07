export function centerScrollLeft(containerWidth: number, cellOffsetLeft: number, cellWidth: number): number {
  return Math.max(0, cellOffsetLeft - (containerWidth - cellWidth) / 2);
}

export function pageScrollDelta(containerWidth: number): number {
  return Math.round(containerWidth * 0.8);
}
