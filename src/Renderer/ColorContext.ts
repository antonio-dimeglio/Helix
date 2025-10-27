import { Protein } from "../PDBParser/Protein";

export class ColorContext {
    minResidueNumber: number;
    maxResidueNumber: number;
    totalResidues: number;
    protein: Protein;

    constructor(protein: Protein) {
        this.minResidueNumber = Number.MAX_SAFE_INTEGER;
        this.maxResidueNumber = Number.MIN_SAFE_INTEGER;
        this.totalResidues = 0;
        this.protein = protein;
    }

    buildColorContext() {
        let set = new Set<number>();
        this.protein.atoms.forEach((atom) => {
            set.add(atom.residueNumber);
        });
        const residuesNumber = Array.from(set);
        this.minResidueNumber = Math.min(...residuesNumber);
        this.maxResidueNumber = Math.max(...residuesNumber);
        this.totalResidues = set.size;
    }
}