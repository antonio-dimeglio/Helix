import { Box3, Color, Frustum, InstancedMesh, Matrix4, MeshLambertMaterial, PerspectiveCamera, SphereGeometry, Vector3 } from "three";
import { Atom } from "../Shared/Atom";
import { ColorScheme } from "./Color/ColorScheme";
import { ColorContext } from "./Color/ColorContext";
import { Octree } from "../Utils/Octree";

interface AtomData {
    atom: Atom;
    index: number;
}

export class CulledAtomRenderer {
    private atoms: Atom[];
    private octree: Octree<AtomData> | null;
    private instancedMesh: InstancedMesh | null;
    private colorScheme: ColorScheme;
    private colorContext: ColorContext;
    private radius: number;
    private widthSegments: number;
    private heightSegments: number;
    private frustum: Frustum;
    private visibleAtoms: Set<number>;
    private matrix: Matrix4;
    private color: Color;

    constructor() {
        this.atoms = [];
        this.octree = null;
        this.instancedMesh = null;
        this.colorScheme = null as any;
        this.colorContext = null as any;
        this.radius = 0.3;
        this.widthSegments = 16;
        this.heightSegments = 16;
        this.frustum = new Frustum();
        this.visibleAtoms = new Set<number>();
        this.matrix = new Matrix4();
        this.color = new Color();
    }

    initialize(
        atoms: Atom[],
        colorScheme: ColorScheme,
        colorContext: ColorContext,
        radius: number = 0.3,
        widthSegments: number = 16,
        heightSegments: number = 16
    ): void {
        this.atoms = atoms;
        this.colorScheme = colorScheme;
        this.colorContext = colorContext;
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;

        this.buildOctree();
        this.createInstancedMesh();

        console.log(`  CulledAtomRenderer: ${atoms.length} atoms, octree stats:`, this.octree?.getStats());
    }

    private buildOctree(): void {
        if (this.atoms.length === 0) return;

        const bounds = new Box3();
        for (const atom of this.atoms) {
            bounds.expandByPoint(new Vector3(atom.x, atom.y, atom.z));
        }
        const padding = 5.0; // 5 Angstroms padding
        bounds.min.subScalar(padding);
        bounds.max.addScalar(padding);
        this.octree = new Octree<AtomData>(bounds, 128, 6);

        // Insert all atoms
        for (let i = 0; i < this.atoms.length; i++) {
            const atom = this.atoms[i];
            const position = new Vector3(atom.x, atom.y, atom.z);
            this.octree.insert(position, { atom, index: i });
        }
    }

    private createInstancedMesh(): void {
        const geometry = new SphereGeometry(this.radius, this.widthSegments, this.heightSegments);
        const material = new MeshLambertMaterial();
        this.instancedMesh = new InstancedMesh(geometry, material, this.atoms.length);

        for (let i = 0; i < this.atoms.length; i++) {
            const atom = this.atoms[i];
            this.matrix.makeTranslation(atom.x, atom.y, atom.z);
            this.instancedMesh.setMatrixAt(i, this.matrix);

            const hexColor = this.colorScheme.getColor(atom, this.colorContext) as number;
            this.color.setHex(hexColor);
            this.instancedMesh.setColorAt(i, this.color);

            this.instancedMesh.setMatrixAt(i, new Matrix4().makeScale(0, 0, 0));
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.instancedMesh.instanceColor) {
            this.instancedMesh.instanceColor.needsUpdate = true;
        }

        this.instancedMesh.frustumCulled = false;
    }

    updateVisibility(camera: PerspectiveCamera): void {
        if (!this.octree || !this.instancedMesh) return;

        const startTime = performance.now();

        this.frustum.setFromProjectionMatrix(
            new Matrix4().multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            )
        );

        const visibleAtomData = this.octree.queryFrustum(this.frustum);

        const newVisibleAtoms = new Set<number>();
        for (const data of visibleAtomData) {
            newVisibleAtoms.add(data.index);
        }

        let showCount = 0;
        let hideCount = 0;

        for (const index of newVisibleAtoms) {
            if (!this.visibleAtoms.has(index)) {
                const atom = this.atoms[index];
                this.matrix.makeTranslation(atom.x, atom.y, atom.z);
                this.instancedMesh.setMatrixAt(index, this.matrix);
                showCount++;
            }
        }

        for (const index of this.visibleAtoms) {
            if (!newVisibleAtoms.has(index)) {
                this.instancedMesh.setMatrixAt(index, new Matrix4().makeScale(0, 0, 0));
                hideCount++;
            }
        }

        this.visibleAtoms = newVisibleAtoms;

        if (showCount > 0 || hideCount > 0) {
            this.instancedMesh.instanceMatrix.needsUpdate = true;
        }

        const elapsed = performance.now() - startTime;
        if (elapsed > 2) { 
            console.log(`  Culling update: ${this.visibleAtoms.size}/${this.atoms.length} visible (${elapsed.toFixed(2)}ms, +${showCount} -${hideCount})`);
        }
    }

    updateColors(colorScheme: ColorScheme, colorContext: ColorContext): void {
        if (!this.instancedMesh) return;

        this.colorScheme = colorScheme;
        this.colorContext = colorContext;

        for (let i = 0; i < this.atoms.length; i++) {
            const atom = this.atoms[i];
            const hexColor = colorScheme.getColor(atom, colorContext) as number;
            this.color.setHex(hexColor);
            this.instancedMesh.setColorAt(i, this.color);
        }

        if (this.instancedMesh.instanceColor) {
            this.instancedMesh.instanceColor.needsUpdate = true;
        }
    }

    
    getMesh(): InstancedMesh | null {
        return this.instancedMesh;
    }

    dispose(): void {
        if (this.instancedMesh) {
            this.instancedMesh.geometry.dispose();
            if (Array.isArray(this.instancedMesh.material)) {
                this.instancedMesh.material.forEach(mat => mat.dispose());
            } else {
                this.instancedMesh.material.dispose();
            }
        }
        this.octree = null;
        this.instancedMesh = null;
    }

    getVisibleCount(): number {
        return this.visibleAtoms.size;
    }

    getTotalCount(): number {
        return this.atoms.length;
    }
}
