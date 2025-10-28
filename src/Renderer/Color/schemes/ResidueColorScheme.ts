import { Atom } from "../../../Shared/Atom";
import { Protein } from "../../../Shared/Protein";
import { getResidueColor } from "../../../Utils/ColorScheme";
import { RenderMode } from "../../RenderMode";
import { ColorContext } from "../ColorContext";
import { ColorScheme } from "../ColorScheme";
import { Parameter } from "../Parameter";

export class ResidueColorScheme implements ColorScheme {
    id = 'residue';
    label = 'By Residue';
    description = 'Colors by amino acid type';
    category: "basic" = 'basic';

    constructor() { }

    isRealtime(): boolean { return true; }
    requiresPrecomputation(): Boolean { return false; }
    isCompatibleWith(_: RenderMode): Boolean { return true; }

    getParameters(): Parameter[] {
        return [];
    }

    getParameter(name: string): any {
        return undefined;
    }

    setParameter(name: string, value: any): void {
    }

    async precompute(protein: Protein): Promise<void> {
    }

    getColor(atom: Atom, context: ColorContext): Number {
        return getResidueColor(atom.residueName);
    }
}
