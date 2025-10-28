import { Atom } from "../Shared/Atom";
import { SecondaryStructure, StructureType } from "../Parser/PDBParser/SecondaryStructure";

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

/**
 * Annotate all atoms with their secondary structure assignment
 */
export function annotateAtomsWithSecondaryStructure(protein: Protein): void {
    for (const atom of protein.atoms) {
        const structureType = protein.secondaryStructure.getStructure(atom.chainID, atom.residueNumber);

        // Map StructureType enum to single character
        switch (structureType) {
            case StructureType.Helix:
                atom.secondaryStructure = 'H';
                break;
            case StructureType.Sheet:
                atom.secondaryStructure = 'E';
                break;
            case StructureType.Loop:
            default:
                atom.secondaryStructure = 'C';
                break;
        }
    }
}