import { Color, CylinderGeometry, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3 } from "three";
import { Atom } from "../Shared/Atom";

export class DisulfideRenderer {
    private readonly DISULFIDE_BOND_DISTANCE = 2.5;
    private readonly BOND_RADIUS = 0.15;
    private readonly BOND_COLOR = 0xFFCC00;

    detectDisulfideBonds(atoms: Atom[]): [number, number][] {
        const disulfideBonds: [number, number][] = [];

        const cysteinesSulfurs: { index: number, atom: Atom }[] = [];
        atoms.forEach((atom, index) => {
            if ((atom.residueName === 'CYS' || atom.residueName === 'CYX') && atom.atomName === 'SG') {
                cysteinesSulfurs.push({ index, atom });
            }
        });

        console.log(`  Found ${cysteinesSulfurs.length} cysteine sulfur atoms`);

        for (let i = 0; i < cysteinesSulfurs.length; i++) {
            for (let j = i + 1; j < cysteinesSulfurs.length; j++) {
                const sulfur1 = cysteinesSulfurs[i];
                const sulfur2 = cysteinesSulfurs[j];

                if (sulfur1.atom.chainID === sulfur2.atom.chainID) {
                    const seqDist = Math.abs(sulfur1.atom.residueNumber - sulfur2.atom.residueNumber);
                    if (seqDist < 3) {
                        continue;
                    }
                }

                const dx = sulfur1.atom.x - sulfur2.atom.x;
                const dy = sulfur1.atom.y - sulfur2.atom.y;
                const dz = sulfur1.atom.z - sulfur2.atom.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (distance <= this.DISULFIDE_BOND_DISTANCE) {
                    disulfideBonds.push([sulfur1.index, sulfur2.index]);
                    console.log(`  Disulfide bond: ${sulfur1.atom.chainID}:${sulfur1.atom.residueNumber} ↔ ${sulfur2.atom.chainID}:${sulfur2.atom.residueNumber} (${distance.toFixed(2)}Å)`);
                }
            }
        }

        return disulfideBonds;
    }

    createDisulfideBondsMesh(atoms: Atom[], bonds: [number, number][]): InstancedMesh | null {
        if (bonds.length === 0) {
            return null;
        }

        console.log(`  Creating ${bonds.length} disulfide bonds`);

        const geometry = new CylinderGeometry(this.BOND_RADIUS, this.BOND_RADIUS, 1, 8);
        const material = new MeshLambertMaterial({ color: this.BOND_COLOR });
        const mesh = new InstancedMesh(geometry, material, bonds.length);

        const matrix = new Matrix4();
        const quaternion = new Quaternion();
        const position = new Vector3();
        const color = new Color(this.BOND_COLOR);

        bonds.forEach((bond, i) => {
            const atom1 = atoms[bond[0]];
            const atom2 = atoms[bond[1]];

            const midX = (atom1.x + atom2.x) / 2;
            const midY = (atom1.y + atom2.y) / 2;
            const midZ = (atom1.z + atom2.z) / 2;

            const dx = atom2.x - atom1.x;
            const dy = atom2.y - atom1.y;
            const dz = atom2.z - atom1.z;
            const bondLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const direction = new Vector3(dx, dy, dz).normalize();
            const up = new Vector3(0, 1, 0);
            quaternion.setFromUnitVectors(up, direction);

            position.set(midX, midY, midZ);
            matrix.compose(position, quaternion, new Vector3(1, bondLength, 1));

            mesh.setMatrixAt(i, matrix);
            mesh.setColorAt(i, color);
        });

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }

        return mesh;
    }
}
