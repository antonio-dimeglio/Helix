import { Box3, Color, Frustum, InstancedMesh, Matrix4, MeshLambertMaterial, PerspectiveCamera, Scene, SphereGeometry, Vector3 } from "three";
import { Atom } from "../Shared/Atom";
import { ColorScheme } from "./Color/ColorScheme";
import { ColorContext } from "./Color/ColorContext";

interface AtomChunk {
    bounds: Box3;
    atoms: Atom[];
    atomIndices: number[];
    mesh: InstancedMesh | null;
    visible: boolean;
}

/**
 * Renders atoms using spatial chunking for efficient frustum culling
 * Each chunk is a separate InstancedMesh that can be shown/hidden independently
 */
export class ChunkedAtomRenderer {
    private atoms: Atom[];
    private chunks: AtomChunk[];
    private colorScheme: ColorScheme;
    private colorContext: ColorContext;
    private radius: number;
    private widthSegments: number;
    private heightSegments: number;
    private frustum: Frustum;
    private scene: Scene;
    private chunkSize: number;
    private matrix: Matrix4;
    private color: Color;
    private geometry: SphereGeometry;
    private material: MeshLambertMaterial;

    constructor(scene: Scene) {
        this.atoms = [];
        this.chunks = [];
        this.colorScheme = null as any;
        this.colorContext = null as any;
        this.radius = 0.3;
        this.widthSegments = 16;
        this.heightSegments = 16;
        this.frustum = new Frustum();
        this.scene = scene;
        this.chunkSize = 40; // Angstroms per chunk (smaller = better culling)
        this.matrix = new Matrix4();
        this.color = new Color();
        this.geometry = null as any;
        this.material = null as any;
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
        this.geometry = new SphereGeometry(this.radius, this.widthSegments, this.heightSegments);
        this.material = new MeshLambertMaterial();
        this.buildChunks();

        console.log(`  ChunkedAtomRenderer: ${atoms.length} atoms in ${this.chunks.length} chunks`);
    }

    private buildChunks(): void {
        if (this.atoms.length === 0) return;

        const overallBounds = new Box3();
        for (const atom of this.atoms) {
            overallBounds.expandByPoint(new Vector3(atom.x, atom.y, atom.z));
        }

        // Adaptive chunk size based on structure size
        // Larger structures = larger chunks (fewer chunks to manage)
        // Smaller structures = smaller chunks (better culling granularity)
        const size = new Vector3();
        overallBounds.getSize(size);
        const structureDiameter = size.length();

        let adaptiveChunkSize = this.chunkSize;
        if (this.atoms.length > 50000) {
            adaptiveChunkSize = 60; // Larger chunks for massive structures
        } else if (this.atoms.length > 20000) {
            adaptiveChunkSize = 50;
        } else if (this.atoms.length > 5000) {
            adaptiveChunkSize = 40;
        } else {
            adaptiveChunkSize = 30; // Smaller chunks for better culling on medium structures
        }

        const numChunksX = Math.ceil(size.x / adaptiveChunkSize);
        const numChunksY = Math.ceil(size.y / adaptiveChunkSize);
        const numChunksZ = Math.ceil(size.z / adaptiveChunkSize);


        const chunkMap = new Map<string, AtomChunk>();

        // Assign atoms to chunks
        for (let i = 0; i < this.atoms.length; i++) {
            const atom = this.atoms[i];
            const pos = new Vector3(atom.x, atom.y, atom.z);

            // Calculate chunk indices
            const chunkX = Math.floor((atom.x - overallBounds.min.x) / adaptiveChunkSize);
            const chunkY = Math.floor((atom.y - overallBounds.min.y) / adaptiveChunkSize);
            const chunkZ = Math.floor((atom.z - overallBounds.min.z) / adaptiveChunkSize);
            const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
            let chunk = chunkMap.get(chunkKey);
            if (!chunk) {
                // Calculate chunk bounds
                const minX = overallBounds.min.x + chunkX * adaptiveChunkSize;
                const minY = overallBounds.min.y + chunkY * adaptiveChunkSize;
                const minZ = overallBounds.min.z + chunkZ * adaptiveChunkSize;
                const maxX = minX + adaptiveChunkSize;
                const maxY = minY + adaptiveChunkSize;
                const maxZ = minZ + adaptiveChunkSize;

                chunk = {
                    bounds: new Box3(
                        new Vector3(minX, minY, minZ),
                        new Vector3(maxX, maxY, maxZ)
                    ),
                    atoms: [],
                    atomIndices: [],
                    mesh: null,
                    visible: false
                };
                chunkMap.set(chunkKey, chunk);
            }

            chunk.atoms.push(atom);
            chunk.atomIndices.push(i);
        }

        // Convert map to array and create meshes
        this.chunks = Array.from(chunkMap.values());

        for (const chunk of this.chunks) {
            this.createChunkMesh(chunk);
        }

        console.log(`  Created ${this.chunks.length} non-empty chunks (avg ${(this.atoms.length / this.chunks.length).toFixed(0)} atoms/chunk)`);
    }

    private createChunkMesh(chunk: AtomChunk): void {
        if (chunk.atoms.length === 0) return;

        chunk.mesh = new InstancedMesh(this.geometry, this.material, chunk.atoms.length);
        chunk.mesh.frustumCulled = true; 

        for (let i = 0; i < chunk.atoms.length; i++) {
            const atom = chunk.atoms[i];
            this.matrix.makeTranslation(atom.x, atom.y, atom.z);
            chunk.mesh.setMatrixAt(i, this.matrix);
            const hexColor = this.colorScheme.getColor(atom, this.colorContext) as number;
            this.color.setHex(hexColor);
            chunk.mesh.setColorAt(i, this.color);
        }

        chunk.mesh.instanceMatrix.needsUpdate = true;
        if (chunk.mesh.instanceColor) {
            chunk.mesh.instanceColor.needsUpdate = true;
        }

        chunk.visible = false;
    }

    updateVisibility(camera: PerspectiveCamera): void {
        const startTime = performance.now();

        this.frustum.setFromProjectionMatrix(
            new Matrix4().multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            )
        );

        let visibleChunks = 0;
        let visibleAtoms = 0;
        let changedChunks = 0;

        for (const chunk of this.chunks) {
            if (!chunk.mesh) continue;

            const shouldBeVisible = this.frustum.intersectsBox(chunk.bounds);

            if (shouldBeVisible !== chunk.visible) {
                if (shouldBeVisible) {
                    this.scene.add(chunk.mesh);
                    visibleAtoms += chunk.atoms.length;
                } else {
                    this.scene.remove(chunk.mesh);
                }
                chunk.visible = shouldBeVisible;
                changedChunks++;
            }

            if (chunk.visible) {
                visibleChunks++;
                visibleAtoms += chunk.atoms.length;
            }
        }

        const elapsed = performance.now() - startTime;
        if (changedChunks > 0 || elapsed > 2) {
            console.log(`  Culling: ${visibleChunks}/${this.chunks.length} chunks, ${visibleAtoms}/${this.atoms.length} atoms visible (${elapsed.toFixed(2)}ms, ±${changedChunks} chunks)`);
        }
    }

    updateColors(colorScheme: ColorScheme, colorContext: ColorContext): void {
        this.colorScheme = colorScheme;
        this.colorContext = colorContext;

        for (const chunk of this.chunks) {
            if (!chunk.mesh) continue;

            for (let i = 0; i < chunk.atoms.length; i++) {
                const atom = chunk.atoms[i];
                const hexColor = colorScheme.getColor(atom, colorContext) as number;
                this.color.setHex(hexColor);
                chunk.mesh.setColorAt(i, this.color);
            }

            if (chunk.mesh.instanceColor) {
                chunk.mesh.instanceColor.needsUpdate = true;
            }
        }
    }

    dispose(): void {
        for (const chunk of this.chunks) {
            if (chunk.mesh) {
                this.scene.remove(chunk.mesh);
                chunk.mesh = null;
            }
        }

        if (this.geometry) {
            this.geometry.dispose();
        }
        if (this.material) {
            this.material.dispose();
        }

        this.chunks = [];
    }

    getVisibleCount(): number {
        let count = 0;
        for (const chunk of this.chunks) {
            if (chunk.visible) {
                count += chunk.atoms.length;
            }
        }
        return count;
    }

    getTotalCount(): number {
        return this.atoms.length;
    }

    getChunkCount(): number {
        return this.chunks.length;
    }
}
