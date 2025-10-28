import { Atom } from "../../../Shared/Atom";
import { Protein } from "../../../Shared/Protein";
import { RenderMode } from "../../RenderMode";
import { ColorContext } from "../ColorContext";
import { ColorScheme } from "../ColorScheme";
import { Parameter } from "../Parameter";

export class RainbowColorScheme implements ColorScheme {
    id = 'rainbow';
    label = 'Rainbow';
    description = 'N→C terminus gradient';
    category: "property" = 'property';

    private chainRanges: Map<string, { min: number; max: number }> = new Map();

    constructor() { }

    isRealtime(): boolean {
        return true;
    }

    requiresPrecomputation(): Boolean {
        return true;
    }

    isCompatibleWith(_: RenderMode): Boolean {
        return true;
    }

    getParameters(): Parameter[] {
        return [
            {
                name: 'startColor',
                label: 'Start Color (N-terminus)',
                type: 'color',
                defaultValue: '#0000FF',  // Blue
                description: 'Color for the N-terminus'
            },
            {
                name: 'endColor',
                label: 'End Color (C-terminus)',
                type: 'color',
                defaultValue: '#FF0000',  // Red
                description: 'Color for the C-terminus'
            }
        ];
    }

    private startColor: number = 0x0000FF;
    private endColor: number = 0xFF0000;

    getParameter(name: string): any {
        switch (name) {
            case 'startColor': return '#' + this.startColor.toString(16).padStart(6, '0');
            case 'endColor': return '#' + this.endColor.toString(16).padStart(6, '0');
            default: return undefined;
        }
    }

    setParameter(name: string, value: any): void {
        const hexValue = value.startsWith('#') ? value.slice(1) : value;
        const numValue = parseInt(hexValue, 16);

        switch (name) {
            case 'startColor':
                this.startColor = numValue;
                break;
            case 'endColor':
                this.endColor = numValue;
                break;
        }
    }

    async precompute(protein: Protein): Promise<void> {
        this.chainRanges.clear();

        // Group atoms by chain and find min/max residue numbers
        const chainResidues: Map<string, Set<number>> = new Map();

        for (const atom of protein.atoms) {
            if (!chainResidues.has(atom.chainID)) {
                chainResidues.set(atom.chainID, new Set());
            }
            chainResidues.get(atom.chainID)!.add(atom.residueNumber);
        }

        for (const [chainID, residues] of chainResidues) {
            const residueArray = Array.from(residues).sort((a, b) => a - b);
            this.chainRanges.set(chainID, {
                min: residueArray[0],
                max: residueArray[residueArray.length - 1]
            });
        }
    }

    
    getColor(atom: Atom, context: ColorContext): Number {
        const range = this.chainRanges.get(atom.chainID);

        if (!range || range.max === range.min) {
            return this.startColor;
        }

        const t = (atom.residueNumber - range.min) / (range.max - range.min);
        return this.interpolateColor(this.startColor, this.endColor, t);
    }

    private interpolateColor(color1: number, color2: number, t: number): number {
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
}
