import { Atom } from "../../Shared/Atom";
import { Protein } from "../../Shared/Protein";
import { RenderMode } from "../RenderMode";
import { ColorContext } from "./ColorContext";
import { Parameter } from "./Parameter"
export interface ColorScheme {
    id: string;
    label: string;
    description: string;
    category: 'basic' | 'property' | 'structural' | 'custom';

    isRealtime(): boolean;
    requiresPrecomputation(): Boolean;
    isCompatibleWith(renderMode: RenderMode): Boolean;

    getParameters(): Parameter[];
    getParameter(name: string): any;
    setParameter(name: string, value: any): void;

    precompute(protein: Protein): Promise<void>;
    getColor(atom: Atom, context: ColorContext): Number;
};