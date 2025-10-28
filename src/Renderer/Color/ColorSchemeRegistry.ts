import { RenderMode } from "../RenderMode";
import { ColorScheme } from "./ColorScheme";

export class ColorSchemeRegistry {
    colorSchemes: ColorScheme[];

    constructor() {
        this.colorSchemes = [];
    }

    registerColorScheme(colorScheme: ColorScheme) {
        this.colorSchemes.push(colorScheme);
    }

    getAvailableFor(renderMode: RenderMode): ColorScheme[] {
        const available: ColorScheme[] = [];
        for (const scheme of this.colorSchemes) {
            if (scheme.isCompatibleWith(renderMode)) {
                available.push(scheme);
            }
        }
        return available
    }

    get(schemeId: string) : ColorScheme | undefined{
        for (const scheme of this.colorSchemes) {
            if (scheme.id === schemeId) {
                return scheme;
            }
        }
        return undefined;
    }
};