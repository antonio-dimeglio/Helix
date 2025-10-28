import { Atom } from "../../../Shared/Atom";
import { Protein } from "../../../Shared/Protein";
import { RenderMode } from "../../RenderMode";
import { ColorContext } from "../ColorContext";
import { ColorScheme } from "../ColorScheme";
import { Parameter } from "../Parameter";

export class SecondaryStructureColorScheme implements ColorScheme {
    id = 'secondary';
    label = 'Secondary Structure';
    description = 'Colors helices, sheets, and loops distinctly';
    category: "structural" = 'structural';

    // Default colors
    private helixColor: number = 0xFF6B6B;  // Red
    private sheetColor: number = 0x4A90E2;  // Blue
    private loopColor: number = 0x7ED321;   // Green

    constructor() { }

    isRealtime(): boolean { return true; }
    requiresPrecomputation(): Boolean { return false; }
    isCompatibleWith(_: RenderMode): Boolean { return true; }

    getParameters(): Parameter[] {
        return [
            {
                name: 'helixColor',
                label: 'Helix Color',
                type: 'color',
                defaultValue: '#FF6B6B',
                description: 'Color for alpha helices'
            },
            {
                name: 'sheetColor',
                label: 'Sheet Color',
                type: 'color',
                defaultValue: '#4A90E2',
                description: 'Color for beta sheets'
            },
            {
                name: 'loopColor',
                label: 'Loop Color',
                type: 'color',
                defaultValue: '#7ED321',
                description: 'Color for loops and coils'
            }
        ];
    }

    getParameter(name: string): any {
        switch (name) {
            case 'helixColor': return '#' + this.helixColor.toString(16).padStart(6, '0');
            case 'sheetColor': return '#' + this.sheetColor.toString(16).padStart(6, '0');
            case 'loopColor': return '#' + this.loopColor.toString(16).padStart(6, '0');
            default: return undefined;
        }
    }

    setParameter(name: string, value: any): void {
        // Convert hex string to number
        const hexValue = value.startsWith('#') ? value.slice(1) : value;
        const numValue = parseInt(hexValue, 16);

        switch (name) {
            case 'helixColor':
                this.helixColor = numValue;
                break;
            case 'sheetColor':
                this.sheetColor = numValue;
                break;
            case 'loopColor':
                this.loopColor = numValue;
                break;
        }
    }

    async precompute(protein: Protein): Promise<void> {
        // No precomputation needed
    }

    getColor(atom: Atom, context: ColorContext): Number {
        const ss = atom.secondaryStructure;

        if (ss === 'H') {
            return this.helixColor;
        } else if (ss === 'E') {
            return this.sheetColor;
        } else {
            // Default to loop/coil color if undefined or 'C'
            return this.loopColor;
        }
    }
}
