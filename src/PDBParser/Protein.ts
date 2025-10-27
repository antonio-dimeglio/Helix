import { Atom } from "./Atom";
import { SecondaryStructure } from "./SecondaryStructure";

export type AtomBond = [number, number];
export type BackboneChain = {
    chainID: string;
    caAtoms: Atom[];
};

export interface Protein {
    atoms: Atom[];
    bonds: AtomBond[];
    name: string;
    numChains: number;
    secondaryStructure: SecondaryStructure;
    backboneChains: BackboneChain[];
}