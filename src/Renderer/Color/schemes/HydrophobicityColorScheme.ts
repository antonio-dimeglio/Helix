import { Atom } from "../../../Shared/Atom";
import { Protein } from "../../../Shared/Protein";
import { interpolateColor } from "../../../Utils/ColorUtils";
import { HYDROPHOBICITY } from "../../../Utils/Hydrophobicity";
import { RenderMode } from "../../RenderMode";
import { ColorContext } from "../ColorContext";
import { ColorScheme } from "../ColorScheme";
import { Parameter } from "../Parameter";

export class HydrophobicityColorScheme implements ColorScheme {
    id = 'hydrophobicity';
    label = 'Hydrophobicity';
    description = 'Hydrophobic (red) to hydrophilic (blue)';
    category: "property" = 'property';

    private hydrophobicColor: number = 0xFF0000;
    private neutralColor: number = 0xFFFFFF;
    private hydrophilicColor: number = 0x0000FF;
    private minHydro: number = -4.5;
    private maxHydro: number = 4.5;


    isRealtime(): boolean { return true; }
    requiresPrecomputation(): Boolean { return false; }
    isCompatibleWith(_: RenderMode): Boolean { return true; }

    getParameters(): Parameter[] {
        return [
            {
                name: 'hydrophobicColor',
                label: 'Hydrophobic Color',
                type: 'color',
                defaultValue: '#FF0000',
                description: 'Color for hydrophobic residues'
            },
            {
                name: 'neutralColor',
                label: 'Neutral Color',
                type: 'color',
                defaultValue: '#FFFFFF',
                description: 'Color for neutral residues'
            },
            {
                name: 'hydrophilicColor',
                label: 'Hydrophilic Color',
                type: 'color',
                defaultValue: '#0000FF',
                description: 'Color for hydrophilic residues'
            }
        ];
    }

    getParameter(name: string): any {
       switch (name) {
            case 'hydrophobicColor': return '#' + this.hydrophobicColor.toString(16).padStart(6, '0');
            case 'neutralColor': return '#' + this.neutralColor.toString(16).padStart(6, '0');
            case 'hydrophilicColor': return '#' + this.hydrophilicColor.toString(16).padStart(6, '0');
            default: return undefined;
        }
    }
    
    setParameter(name: string, value: any): void {
        const hexValue = value.startsWith('#') ? value.slice(1) : value;
        const numValue = parseInt(hexValue, 16);

        switch (name) {
            case 'hydrophobicColor': this.hydrophobicColor = numValue; break;
            case 'neutralColor': this.neutralColor = numValue; break;
            case 'hydrophilicColor': this.hydrophilicColor = numValue; break;
        }
    }
    
    async precompute(protein: Protein): Promise<void> { }

    getColor(atom: Atom, context: ColorContext): Number {
        const value = HYDROPHOBICITY[atom.residueName] ?? 0;
        const normalized = (value - this.minHydro) / (this.maxHydro - this.minHydro);
        
        if (normalized < 0.5) {
            // going from hydrophilic to netural (0 -> 0.5)
            const t = normalized * 2; 
            return interpolateColor(this.hydrophilicColor, 
                this.neutralColor, t
            );
        } else {
            // going from neutral to hydrophobic (0.5 -> 1)
            const t = (normalized - 0.5) * 2;
            return interpolateColor(this.neutralColor,
                this.hydrophobicColor, t
            );
        }
    }

}