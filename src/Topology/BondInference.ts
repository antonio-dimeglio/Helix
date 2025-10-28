import { Atom } from "../Shared/Atom";
import { AtomBond } from "../Shared/Protein";
import { VDW_RADII } from "../Utils/VanDerWaals";
import { TopologyLibrary } from "./TopologyLibrary";

function addBond(idx1: number, idx2: number, bondSet: Set<string>) {
    const min = Math.min(idx1, idx2);
    const max = Math.max(idx1, idx2);
    bondSet.add(`${min},${max}`);
}

export function inferBonds(atoms: Atom[], conectRecords: Map<number, number[]>): AtomBond[] {
    const topology = new TopologyLibrary();
    const residueGroups = new Map<string, number[]>();
    const bondSet = new Set<string>();
    const serialToIndex = new Map<number, number>();
    const BOND_TOLERANCE = 0.6;
    const MAX_BOND_DISTANCE = 3.0;

    atoms.forEach((atom, index) => {
        const residueKey = `${atom.residueName}-${atom.residueNumber}-${atom.chainID}`;
        if (!residueGroups.has(residueKey))  {
            residueGroups.set(residueKey, []);
        }
        residueGroups.get(residueKey)!.push(index);
        serialToIndex.set(atom.serialNumber, index);
    });

    let conectBondCount = 0;
    let distanceInferredCount = 0;
    for (let [src, dests] of conectRecords) {
        const srcIdx = serialToIndex.get(src);
        if (srcIdx === undefined) {
            console.warn(`CONECT: source serial ${src} not found in atoms`);
            continue;
        }
        for (let dest of dests) {
            const destIdx = serialToIndex.get(dest);
            if (destIdx === undefined) {
                console.warn(`CONECT: dest serial ${dest} not found in atoms`);
                continue;
            }
            addBond(srcIdx, destIdx, bondSet);
            conectBondCount++;
        }
    }

    residueGroups.forEach((atomIndices, residueKey) => {
        const residueName = residueKey.split('-')[0];
        const template = topology.getTemplate(residueName);

        if (!template) {
            // Distance-based inference for unknown residues
            let bondsAdded = 0;
            for (let i = 0; i < atomIndices.length; i++) {
                for (let j = i + 1; j < atomIndices.length; j++) {
                    const idx1 = atomIndices[i]
                    const idx2 = atomIndices[j]
                    const atom1 = atoms[idx1]
                    const atom2 = atoms[idx2]

                    const dx = atom2.x - atom1.x
                    const dy = atom2.y - atom1.y
                    const dz = atom2.z - atom1.z
                    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz)

                    if (distance > MAX_BOND_DISTANCE) continue

                    const vdw1 = VDW_RADII[atom1.element] || 1.7  // Default to carbon
                    const vdw2 = VDW_RADII[atom2.element] || 1.7

                    // Check if bonded
                    if (distance < (vdw1 + vdw2) * BOND_TOLERANCE) {
                        addBond(idx1, idx2, bondSet)
                        bondsAdded++;
                    }
                }
            }
            console.log(`  → Added ${bondsAdded} bonds for ${residueName}`)
            distanceInferredCount++;
        } else {
            template.bonds.forEach(([atomName1, atomName2]) => {
                const index1 = atomIndices.find(i => atoms[i].atomName === atomName1);
                const index2 = atomIndices.find(i => atoms[i].atomName === atomName2);

                if (index1 !== undefined && index2 !== undefined) {
                    addBond(index1, index2, bondSet);
                }
            });
        }
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

    chainResidues.forEach((residues, _) => {
        // Sort by residue number
        residues.sort((a, b) => a.residueNum - b.residueNum);

        // Connect each residue to the next
        for (let i = 0; i < residues.length - 1; i++) {
            const currentRes = residues[i];
            const nextRes = residues[i + 1];

            const cIndex = currentRes.atomIndices.find(idx => atoms[idx].atomName === 'C');
            const nIndex = nextRes.atomIndices.find(idx => atoms[idx].atomName === 'N');

            if (cIndex !== undefined && nIndex !== undefined) {
                addBond(cIndex, nIndex, bondSet);
            }
        }
    });

    console.log(`Applied distance-based inference to ${distanceInferredCount} unknown residue types`);

    const bonds: AtomBond[] = [];

    bondSet.forEach(bondStr => {
        const [idx1, idx2] = bondStr.split(',').map(Number);
        bonds.push([idx1, idx2]);
    })

    return bonds;
}