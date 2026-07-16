/** Blends a hex color toward white by `amount` (0-1), used to derive a pastel tint for pixel-art textures. */
export function lightenColor(hex: number, amount: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return (mix(r) << 16) + (mix(g) << 8) + mix(b);
}

/** Multiplies a hex color's channels by `factor` (e.g. 0.85 to darken slightly). */
export function shadeColor(hex: number, factor: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((hex & 0xff) * factor));
  return (r << 16) + (g << 8) + b;
}
