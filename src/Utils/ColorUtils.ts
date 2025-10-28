/**
 * Color interpolation and manipulation utilities for property-based color schemes
 */

/**
 * Linear interpolation between two colors
 * @param color1 First color as hex number (e.g., 0xFF0000)
 * @param color2 Second color as hex number (e.g., 0x0000FF)
 * @param t Interpolation factor (0-1)
 * @returns Interpolated color as hex number
 */
export function interpolateColor(color1: number, color2: number, t: number): number {
    // Clamp t to 0-1 range
    t = Math.max(0, Math.min(1, t));

    const r1 = (color1 >> 16) & 0xFF;
    const g1 = (color1 >> 8) & 0xFF;
    const b1 = color1 & 0xFF;

    const r2 = (color2 >> 16) & 0xFF;
    const g2 = (color2 >> 8) & 0xFF;
    const b2 = color2 & 0xFF;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
}

/**
 * Interpolation between three colors (diverging gradient)
 * @param color1 First color (low value)
 * @param color2 Middle color (neutral/midpoint)
 * @param color3 Third color (high value)
 * @param t Interpolation factor (0-1)
 * @returns Interpolated color
 */
export function interpolate3Color(
    color1: number,
    color2: number,
    color3: number,
    t: number
): number {
    t = Math.max(0, Math.min(1, t));

    if (t < 0.5) {
        // Interpolate between color1 and color2
        return interpolateColor(color1, color2, t * 2);
    } else {
        // Interpolate between color2 and color3
        return interpolateColor(color2, color3, (t - 0.5) * 2);
    }
}

/**
 * Multi-stop gradient interpolation
 * @param stops Array of {position: 0-1, color: number}
 * @param t Interpolation factor (0-1)
 * @returns Interpolated color
 */
export function interpolateGradient(
    stops: Array<{ position: number; color: number }>,
    t: number
): number {
    t = Math.max(0, Math.min(1, t));

    // Sort stops by position
    const sorted = stops.slice().sort((a, b) => a.position - b.position);

    // Find the two stops to interpolate between
    for (let i = 0; i < sorted.length - 1; i++) {
        const stop1 = sorted[i];
        const stop2 = sorted[i + 1];

        if (t >= stop1.position && t <= stop2.position) {
            // Normalize t to this segment
            const segmentT = (t - stop1.position) / (stop2.position - stop1.position);
            return interpolateColor(stop1.color, stop2.color, segmentT);
        }
    }

    // If t is beyond all stops, return the last color
    return sorted[sorted.length - 1].color;
}

/**
 * Convert hex string to number
 * @param hex Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns Color as number
 */
export function hexToNumber(hex: string): number {
    const cleaned = hex.startsWith('#') ? hex.slice(1) : hex;
    return parseInt(cleaned, 16);
}

/**
 * Convert number to hex string
 * @param color Color as number
 * @returns Hex string with # prefix
 */
export function numberToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0').toUpperCase();
}

/**
 * Normalize a value to 0-1 range
 * @param value Value to normalize
 * @param min Minimum value
 * @param max Maximum value
 * @returns Normalized value (0-1), or 0 if min === max
 */
export function normalize(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return (value - min) / (max - min);
}

/**
 * Common color gradients for property-based schemes
 */
export const GRADIENTS = {
    // Blue → Red (common for many properties)
    blueRed: {
        start: 0x0000FF,
        end: 0xFF0000
    },
    // Blue → White → Red (diverging)
    blueWhiteRed: {
        start: 0x0000FF,
        mid: 0xFFFFFF,
        end: 0xFF0000
    },
    // Green → Yellow → Red (traffic light)
    greenYellowRed: {
        start: 0x00FF00,
        mid: 0xFFFF00,
        end: 0xFF0000
    },
    // Cyan → Yellow (viridis-like, perceptually uniform)
    cyanYellow: {
        start: 0x00FFFF,
        end: 0xFFFF00
    },
    // Rainbow spectrum
    rainbow: [
        { position: 0.0, color: 0x0000FF },  // Blue
        { position: 0.25, color: 0x00FFFF }, // Cyan
        { position: 0.5, color: 0x00FF00 },  // Green
        { position: 0.75, color: 0xFFFF00 }, // Yellow
        { position: 1.0, color: 0xFF0000 }   // Red
    ]
};
