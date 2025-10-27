import { CylinderGeometry, InstancedMesh, Matrix4, Vector3, Quaternion, Color, MeshLambertMaterial } from "three";
import { Atom } from "../PDBParser/Atom";
import { AtomBond } from "../PDBParser/Protein";

const bondRadius = 0.1;
const bondColor = 0x909090; // Grey

export function createBondsMesh(atoms: Atom[], bonds: AtomBond[]): InstancedMesh {
    const count = bonds.length;
    const geometry = new CylinderGeometry(bondRadius, bondRadius, 1);
    const material = new MeshLambertMaterial();
    const instancedMesh = new InstancedMesh(geometry, material, count);

    const matrix = new Matrix4();
    const color = new Color(bondColor);
    const cylinderUp = new Vector3(0, 1, 0);

    bonds.forEach(([index1, index2], i) => {
        const atom1 = atoms[index1];
        const atom2 = atoms[index2];

        const pos1 = new Vector3(atom1.x, atom1.y, atom1.z);
        const pos2 = new Vector3(atom2.x, atom2.y, atom2.z);
        const midpoint = new Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);
        const bondLength = pos1.distanceTo(pos2);
        const direction = new Vector3().subVectors(pos2, pos1).normalize();

        const quaternion = new Quaternion();
        quaternion.setFromUnitVectors(cylinderUp, direction);

        matrix.compose(
            midpoint,
            quaternion,
            new Vector3(1, bondLength, 1)
        );

        instancedMesh.setMatrixAt(i, matrix);
        instancedMesh.setColorAt(i, color);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
    }

    return instancedMesh;
}