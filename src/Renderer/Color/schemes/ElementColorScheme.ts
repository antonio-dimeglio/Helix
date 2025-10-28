import { Atom } from "../../../Shared/Atom";
import { Protein } from "../../../Shared/Protein";
import { getElementColor } from "../../../Utils/ColorScheme";
import { RenderMode } from "../../RenderMode";
import { ColorContext } from "../ColorContext";
import { ColorScheme } from "../ColorScheme";
import { Parameter } from "../Parameter";

export class ElementColorScheme implements ColorScheme {
    id = 'element';
    label = 'By Element';
    description = 'Standard atom coloring scheme used in chemistry. Changes apply instantly.';
    category: "basic" = 'basic';
    private preset: string = 'CPK';

    constructor() { }

    isRealtime(): boolean { return true; }
    requiresPrecomputation(): Boolean { return false; }
    isCompatibleWith(_: RenderMode): Boolean { return true; }

    getParameters(): Parameter[] {
        return [
            {
                name: 'preset',
                label: 'Color Preset',
                type: 'select',
                defaultValue: 'CPK',
                options: ['CPK', 'Rasmol', 'Jmol'],
                description: 'Choose element color palette'
            }
        ];
    }

    getParameter(name: string): any {
        if (name === 'preset') {
            return this.preset;
        }
        return undefined;
    }

    setParameter(name: string, value: any): void {
        if (name === 'preset') {
            this.preset = value;
        }
    }

    async precompute(protein: Protein): Promise<void> {}

    getColor(atom: Atom, context: ColorContext): Number {
        return getElementColor(atom.element, this.preset);
    }
};