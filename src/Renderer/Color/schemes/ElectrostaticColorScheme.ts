import { Atom } from "../../../Shared/Atom";
import { Protein } from "../../../Shared/Protein";
import { ELECTROSTATIC_POTENTIAL } from "../../../Utils/Potential";
import { RenderMode } from "../../RenderMode";
import { ColorContext } from "../ColorContext";
import { ColorScheme } from "../ColorScheme";
import { Parameter } from "../Parameter";


interface Coordinate {
    position: [number, number, number];
    charge: number;
    residueName: string;
}

export class ElectrostaticColorScheme implements ColorScheme {
    id = 'electrostatic';
    label = 'Electrostatic';
    description = 'Surface Charge potential';
    category: 'property' = 'property';

    // Precomputed data
    chargedAtoms: Coordinate[] = [];
    potentials: Float32Array = new Float32Array(0);
    atomIndexMap: Map<number, number> = new Map(); // serialNumber -> index
    globalMinPotential: number = -10.0;
    globalMaxPotential: number = 10.0;

    // User parameters
    distanceCutoff: number = 15.0;
    negativeColor: number = 0xFF0000;  // Red
    neutralColor: number = 0xFFFFFF;   // White
    positiveColor: number = 0x0000FF;  // Blue
    useAutoRange: boolean = true;
    minThreshold: number = -10.0;
    maxThreshold: number = 10.0;

    isRealtime(): boolean { return false; }

    requiresPrecomputation(): Boolean { return true; }
    isCompatibleWith(renderMode: RenderMode): Boolean { return true; }
    getParameters(): Parameter[] {
        return [
            {
                name: 'distanceCutoff',
                label: 'Distance Cutoff (Å)',
                type: 'number',
                defaultValue: 15.0,
                min: 5,
                max: 30,
                step: 0.5,
                description: 'Ignore charges beyond this distance'
            },
            {
                name: 'useAutoRange',
                label: 'Auto-detect Range',
                type: 'checkbox',
                defaultValue: true,
                description: 'Automatically find min/max potentials'
            },
            {
                name: 'minThreshold',
                label: 'Min Potential',
                type: 'number',
                defaultValue: -10.0,
                min: -50,
                max: 0,
                step: 0.5,
                description: 'Minimum potential (manual mode)'
            },
            {
                name: 'maxThreshold',
                label: 'Max Potential',
                type: 'number',
                defaultValue: 10.0,
                min: 0,
                max: 50,
                step: 0.5,
                description: 'Maximum potential (manual mode)'
            },
            {
                name: 'negativeColor',
                label: 'Negative Charge Color',
                type: 'color',
                defaultValue: '#FF0000',
                description: 'Acidic regions (ASP, GLU)'
            },
            {
                name: 'neutralColor',
                label: 'Neutral Color',
                type: 'color',
                defaultValue: '#FFFFFF',
                description: 'Uncharged regions'
            },
            {
                name: 'positiveColor',
                label: 'Positive Charge Color',
                type: 'color',
                defaultValue: '#0000FF',
                description: 'Basic regions (LYS, ARG, HIS)'
            }
        ];

    }

    getParameter(name: string) {
        switch (name) {
            case 'distanceCutoff':
                return this.distanceCutoff;
            case 'useAutoRange':
                return this.useAutoRange;
            case 'minThreshold':
                return this.minThreshold;
            case 'maxThreshold':
                return this.maxThreshold;
            case 'negativeColor':
                return '#' + this.negativeColor.toString(16).padStart(6, '0');
            case 'neutralColor':
                return '#' + this.neutralColor.toString(16).padStart(6, '0');
            case 'positiveColor':
                return '#' + this.positiveColor.toString(16).padStart(6, '0');
            default:
                return undefined;
        }
    }

    setParameter(name: string, value: any): void {
        switch (name) {
            case 'distanceCutoff':
                this.distanceCutoff = parseFloat(value);
                break;
            case 'useAutoRange':
                this.useAutoRange = value;
                if (this.useAutoRange) {
                    this.minThreshold = this.globalMinPotential;
                    this.maxThreshold = this.globalMaxPotential;
                }
                break;
            case 'minThreshold':
                this.minThreshold = parseFloat(value);
                break;
            case 'maxThreshold':
                this.maxThreshold = parseFloat(value);
                break;
            case 'negativeColor':
            case 'neutralColor':
            case 'positiveColor':
                const hexValue = value.startsWith('#') ? value.slice(1) : value;
                const numValue = parseInt(hexValue, 16);
                if (name === 'negativeColor') this.negativeColor = numValue;
                else if (name === 'neutralColor') this.neutralColor = numValue;
                else if (name === 'positiveColor') this.positiveColor = numValue;
                break;
        }
    }

    async precompute(protein: Protein): Promise<void> {
        console.log('ElectrostaticColorScheme: Starting precomputation...');
        const startTime = performance.now();

        // STEP 1: Build atom index map
        this.atomIndexMap.clear();
        for (let i = 0; i < protein.atoms.length; i++) {
            this.atomIndexMap.set(protein.atoms[i].serialNumber, i);
        }

        // STEP 2: Identify charged atoms
        this.chargedAtoms = protein.atoms
            .filter(atom => {
                const charge = ELECTROSTATIC_POTENTIAL[atom.residueName];
                return charge !== undefined && charge !== 0;
            })
            .filter(atom => {
                const res = atom.residueName, name = atom.atomName;
                return (
                    (res === 'ASP' && ['CG','OD1','OD2'].includes(name)) ||
                    (res === 'GLU' && ['CD','OE1','OE2'].includes(name)) ||
                    (res === 'LYS' && name === 'NZ') ||
                    (res === 'ARG' && ['CZ','NH1','NH2'].includes(name)) ||
                    (res === 'HIS' && ['ND1','NE2'].includes(name))
                );
            })
            .map(atom => ({
                position: [atom.x, atom.y, atom.z] as [number, number, number],
                charge: ELECTROSTATIC_POTENTIAL[atom.residueName],
                residueName: atom.residueName
            }));

        console.log(`  Found ${this.chargedAtoms.length} charged atoms`);

        if (this.chargedAtoms.length === 0) {
            console.warn('  No charged atoms found');
            this.potentials = new Float32Array(protein.atoms.length);
            return;
        }

        // STEP 3: Calculate potentials for all atoms (O(n*m) - expensive!)
        this.potentials = new Float32Array(protein.atoms.length);
        const cutoffSq = this.distanceCutoff * this.distanceCutoff;

        for (let i = 0; i < protein.atoms.length; i++) {
            const atom = protein.atoms[i];
            let potential = 0.0;

            // Sum contributions from all charged atoms
            for (const chargedAtom of this.chargedAtoms) {
                const dx = atom.x - chargedAtom.position[0];
                const dy = atom.y - chargedAtom.position[1];
                const dz = atom.z - chargedAtom.position[2];
                const distSq = dx * dx + dy * dy + dz * dz;

                // Skip if beyond cutoff
                if (distSq > cutoffSq) continue;

                const distance = Math.sqrt(distSq);

                // Avoid division by zero
                if (distance < 0.1) continue;

                // Coulomb potential: V = q/r
                potential += chargedAtom.charge / distance;
            }

            this.potentials[i] = potential;

            // Progress updates for large proteins
            if (i % 10000 === 0 && i > 0) {
                console.log(`  Computing: ${i}/${protein.atoms.length} atoms`);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // STEP 4: Find global min/max
        let minPot = Infinity;
        let maxPot = -Infinity;
        for (let i = 0; i < this.potentials.length; i++) {
            const pot = this.potentials[i];
            if (pot < minPot) minPot = pot;
            if (pot > maxPot) maxPot = pot;
        }

        this.globalMinPotential = minPot;
        this.globalMaxPotential = maxPot;

        console.log(`  Potential range: ${minPot.toFixed(3)} to ${maxPot.toFixed(3)}`);

        if (this.useAutoRange) {
            this.minThreshold = this.globalMinPotential;
            this.maxThreshold = this.globalMaxPotential;
        }

        const elapsed = performance.now() - startTime;
        console.log(`ElectrostaticColorScheme: Complete (${elapsed.toFixed(0)}ms)`);
    }

    getColor(atom: Atom, context: ColorContext): Number {
        const atomIndex = this.atomIndexMap.get(atom.serialNumber);
        if (atomIndex === undefined) {
            return 0x808080;
        }

        const potential = this.potentials[atomIndex];
        const clamped = Math.max(this.minThreshold, Math.min(this.maxThreshold, potential));

        // Normalize to [-1, +1] (symmetric around 0)
        const maxAbsPotential = Math.max(Math.abs(this.minThreshold), Math.abs(this.maxThreshold));

        let normalized = 0;
        if (maxAbsPotential > 0) {
            normalized = clamped / maxAbsPotential;
        }

        // Diverging gradient: negative → neutral → positive
        if (normalized < 0) {
            const t = (normalized + 1.0);
            return this.interpolateColor(this.negativeColor, this.neutralColor, t);
        } else {
            const t = normalized;
            return this.interpolateColor(this.neutralColor, this.positiveColor, t);
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

};