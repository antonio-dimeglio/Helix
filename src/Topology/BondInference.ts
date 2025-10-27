import { Atom } from "../PDBParser/Atom";
import { AtomBond } from "../PDBParser/Protein";
import { TopologyLibrary } from "./TopologyLibrary";

export function inferBonds(atoms: Atom[]): AtomBond[] {
    const topology = new TopologyLibrary();
    const bonds: AtomBond[] = [];
    const residueGroups = new Map<string, number[]>();

    atoms.forEach((atom, index) => {
        const residueKey = `${atom.residueName}-${atom.residueNumber}-${atom.chainID}`;
        if (!residueGroups.has(residueKey))  {
            residueGroups.set(residueKey, []);
        }
        residueGroups.get(residueKey)!.push(index);
    });

    residueGroups.forEach((atomIndices, residueKey) => {
        const residueName = residueKey.split('-')[0];
        const template = topology.getTemplate(residueName);
        if (!template) {
            console.warn(`No template found for residue: ${residueName}`);
            return; // Skip unknown residues
        }
        template.bonds.forEach(([atomName1, atomName2]) => {    
            const index1 = atomIndices.find(i => atoms[i].atomName === atomName1);
            const index2 = atomIndices.find(i => atoms[i].atomName === atomName2);
            
            if (index1 !== undefined && index2 !== undefined) {
                bonds.push([index1, index2]);
            }
        });
    });

    const chainResidues = new Map<string, Array<{residueNum: number, atomIndices: number[]}>>();

    residueGroups.forEach((atomIndices, residueKey) => {
        const [_, residueNumStr, chainID] = residueKey.split('-');
        const residueNum = Number(residueNumStr);

        if (!chainResidues.has(chainID)) {
            chainResidues.set(chainID, []);
        }
        chainResidues.get(chainID)!.push({ residueNum, atomIndices });
    });

    // For each chain, connect sequential residues
    chainResidues.forEach((residues, _) => {
        // Sort by residue number
        residues.sort((a, b) => a.residueNum - b.residueNum);

        // Connect each residue to the next
        for (let i = 0; i < residues.length - 1; i++) {
            const currentRes = residues[i];
            const nextRes = residues[i + 1];

            // Find C atom in current residue
            const cIndex = currentRes.atomIndices.find(idx => atoms[idx].atomName === 'C');
            // Find N atom in next residue
            const nIndex = nextRes.atomIndices.find(idx => atoms[idx].atomName === 'N');

            if (cIndex !== undefined && nIndex !== undefined) {
                bonds.push([cIndex, nIndex]);
            }
        }
    });

    return bonds;
}