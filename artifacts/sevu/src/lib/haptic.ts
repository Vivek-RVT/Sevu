export function haptic(type: "light" | "medium" | "success" = "light") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const patterns: Record<string, number | number[]> = {
    light: 8,
    medium: 15,
    success: [8, 40, 8],
  };
  navigator.vibrate(patterns[type]);
}
