import { Atom } from "../../../Shared/Atom";
import { Protein } from "../../../Shared/Protein";
import { interpolateColor } from "../../../Utils/ColorUtils";
import { RenderMode } from "../../RenderMode";
import { ColorContext } from "../ColorContext";
import { ColorScheme } from "../ColorScheme";
import { Parameter } from "../Parameter";

const BLUE = 0x0000FF;
const RED = 0xFF0000;

export class BFactorColorScheme implements ColorScheme {
    id = 'bfactor';
    label = 'B-Factor';
    description = 'Termal motion/disorder';
    category: 'property' = 'property';
    private globalMinBFactor: number = 0;
    private globalMaxBFactor: number = 100;
    private minThreshold: number = 0;  
    private maxThreshold: number = 100; 
    private lowColor: number = 0x0000FF; 
    private midColor: number = 0x00FF00;
    private highColor: number = 0xFF0000;
    private useAutoRange: boolean = true;
    
    
    isRealtime(): boolean { return true; }
    requiresPrecomputation(): Boolean { return true; }
    isCompatibleWith(_: RenderMode): Boolean { return true; }

    getParameters(): Parameter[] {
        return [
            {
                name: 'useAutoRange',
                label: 'Auto-detect Range',
                type: 'checkbox',
                defaultValue: true,
                description: 'Automatically find min/max B-factors from structure'
            },
            {
                name: 'minThreshold',
                label: 'Minimum B-Factor',
                type: 'number',
                defaultValue: 0,
                min: 0,
                max: 200,
                step: 0.1,
                description: 'B-factors below this are clamped (manual mode)'
            },
            {
                name: 'maxThreshold',
                label: 'Maximum B-Factor',
                type: 'number',
                defaultValue: 100,
                min: 0,
                max: 200,
                step: 0.1,
                description: 'B-factors above this are clamped (manual mode)'
            },
            {
                name: 'lowColor',
                label: 'Low B-Factor Color',
                type: 'color',
                defaultValue: '#0000FF',
                description: 'Color for rigid/well-ordered regions'
            },
            {
                name: 'midColor',
                label: 'Medium B-Factor Color',
                type: 'color',
                defaultValue: '#00FF00',
                description: 'Color for medium flexibility'
            },
            {
                name: 'highColor',
                label: 'High B-Factor Color',
                type: 'color',
                defaultValue: '#FF0000',
                description: 'Color for flexible/disordered regions'
            }
        ];

    }
    
    getParameter(name: string): any {
        switch (name) {
            case 'useAutoRange':
                return this.useAutoRange;
            case 'minThreshold':
                return this.minThreshold;
            case 'maxThreshold':
                return this.maxThreshold;
            case 'lowColor':
                return '#' + this.lowColor.toString(16).padStart(6, '0');
            case 'midColor':
                return '#' + this.midColor.toString(16).padStart(6, '0');
            case 'highColor':
                return '#' + this.highColor.toString(16).padStart(6, '0');
            default:
                return undefined;
        }
    }

    setParameter(name: string, value: any): void {
        switch (name) {
            case 'useAutoRange':
                this.useAutoRange = value;
                if (this.useAutoRange) {
                    this.minThreshold = this.globalMinBFactor;
                    this.maxThreshold = this.globalMaxBFactor;
                }
                break;
            case 'minThreshold':
                this.minThreshold = parseFloat(value);
                break;
            case 'maxThreshold':
                this.maxThreshold = parseFloat(value);
                break;
            case 'lowColor':
            case 'midColor':
            case 'highColor':
                const hexValue = value.startsWith('#') ? value.slice(1) : value;
                const numValue = parseInt(hexValue, 16);
                if (name === 'lowColor') this.lowColor = numValue;
                else if (name === 'midColor') this.midColor = numValue;
                else if (name === 'highColor') this.highColor = numValue;
                break;
        }
    }

    async precompute(protein: Protein): Promise<void> {
        const bFactors = protein.atoms
            .map(a => a.bFactor)
            .filter(b => b !== undefined) as number[];

        if (bFactors.length === 0) {
            console.warn('No B-factor data found in structure');
            this.globalMinBFactor = 0;
            this.globalMaxBFactor = 100;
            return;
        }

        this.globalMinBFactor = Math.min(...bFactors);
        this.globalMaxBFactor = Math.max(...bFactors);

        console.log(`B-Factor range: ${this.globalMinBFactor.toFixed(2)} - ${this.globalMaxBFactor.toFixed(2)}`);

        if (this.useAutoRange) {
            this.minThreshold = this.globalMinBFactor;
            this.maxThreshold = this.globalMaxBFactor;
        }
    }

    getColor(atom: Atom, context: ColorContext): number {
        if (atom.bFactor === undefined) {
            return 0x808080;
        }

        const min = this.minThreshold;
        const max = this.maxThreshold;
        const clamped = Math.max(min, Math.min(max, atom.bFactor));
        const t = max > min ? (clamped - min) / (max - min) : 0;

        return this.interpolate3Color(this.lowColor, this.midColor, this.highColor, t);
    }

    private interpolate3Color(low: number, mid: number, high: number, t: number): number {
        if (t < 0.5) {
            return this.interpolateColor(low, mid, t * 2);
        } else {
            return this.interpolateColor(mid, high, (t - 0.5) * 2);
        }
    }


    private interpolateColor(color1: number, color2: number, t: number): number {
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

}