import { lerp } from "three/src/math/MathUtils.js";
import { Atom } from "../Shared/Atom";
import { BackboneChain } from "../Shared/Protein";
import { StructureType, SecondaryStructure } from "../Parser/PDBParser/SecondaryStructure";
import { ColorMode } from "./AtomRenderer";
import { ColorContext } from "./Color/ColorContext";
import { ColorScheme } from "./Color/ColorScheme";
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial, TubeGeometry, Vector3 } from "three";

export type Segment = {
    type: StructureType;
    atoms: Atom[];
    startResidue: number;
    endResidue: number;
    chainID: string;
};

export class CartoonRenderer {
    private detailLevel: number = 64; 

    createCartoonMesh(
        backboneChains: BackboneChain[],
        secondaryStructure: SecondaryStructure,
        colorScheme: ColorScheme,
        colorContext: ColorContext
    ): Group {
        const group = new Group();
        const totalAtoms = backboneChains.reduce((sum, chain) => sum + chain.caAtoms.length, 0);

        console.log(`CartoonRenderer: Creating cartoon for ${backboneChains.length} chains, ${totalAtoms} CA atoms`);

        if (totalAtoms > 1000) {
            this.detailLevel = 24;
        } else if (totalAtoms > 500) {
            this.detailLevel = 32;
        } else {
            this.detailLevel = 48;
        }


        for (const chain of backboneChains) {
            console.log(`  Chain ${chain.chainID}: ${chain.caAtoms.length} CA atoms`);

            // IMPORTANT: NMR structures have multiple models with duplicate residue numbers
            // Also handle alternate conformations (altLoc A, B, etc.)
            // Strategy: Keep first occurrence of each residue, preferring highest occupancy
            const uniqueResidues = new Map<number, Atom>();
            for (const atom of chain.caAtoms) {
                const existing = uniqueResidues.get(atom.residueNumber);

                if (!existing) {
                    // No atom for this residue yet - take it
                    uniqueResidues.set(atom.residueNumber, atom);
                } else if (atom.altLoc && existing.altLoc) {
                    // Both have altLoc - prefer higher occupancy or earlier altLoc (A over B)
                    const atomOcc = atom.occupancy || 0;
                    const existingOcc = existing.occupancy || 0;

                    if (atomOcc > existingOcc || (atomOcc === existingOcc && atom.altLoc < existing.altLoc)) {
                        uniqueResidues.set(atom.residueNumber, atom);
                    }
                } else if (!atom.altLoc && existing.altLoc) {
                    // Prefer non-altLoc over altLoc
                    uniqueResidues.set(atom.residueNumber, atom);
                }
                // Otherwise keep existing
            }

            const deduplicatedAtoms = Array.from(uniqueResidues.values()).sort((a, b) => a.residueNumber - b.residueNumber);

            if (deduplicatedAtoms.length !== chain.caAtoms.length) {
                console.warn(`    Detected NMR structure: ${chain.caAtoms.length} atoms reduced to ${deduplicatedAtoms.length} unique residues`);
            }

            // Create a temporary chain with deduplicated atoms
            const deduplicatedChain: BackboneChain = {
                chainID: chain.chainID,
                caAtoms: deduplicatedAtoms
            };

            const segments = this.segmentChain(deduplicatedChain, secondaryStructure);
            console.log(`    Found ${segments.length} segments`);

            for (const segment of segments) {
                if (segment.atoms.length < 2) {
                    console.warn(`    Skipping ${segment.type} segment - too few atoms (${segment.atoms.length})`);
                    continue;
                }

                console.log(`    Rendering ${segment.type} segment: residues ${segment.startResidue}-${segment.endResidue} (${segment.atoms.length} atoms)`)

                // Get color from the middle atom of the segment (representative color)
                const midAtom = segment.atoms[Math.floor(segment.atoms.length / 2)];
                const color = colorScheme.getColor(midAtom, colorContext) as number;

                try {
                    let mesh: Mesh;
                    switch (segment.type) {
                        case StructureType.Loop:
                            mesh = this.createLoopGeometry(segment, color);
                            break;
                        case StructureType.Helix:
                            mesh = this.createHelixGeometry(segment, color);
                            break;
                        case StructureType.Sheet:
                            mesh = this.createSheetGeometry(segment, color);
                            break;
                        default:
                            mesh = this.createLoopGeometry(segment, color);
                            break;
                    }

                    // Validate geometry before adding
                    if (mesh && mesh.geometry && mesh.geometry.attributes.position) {
                        const positions = mesh.geometry.attributes.position.array;
                        let hasNaN = false;
                        for (let i = 0; i < positions.length; i++) {
                            if (!isFinite(positions[i])) {
                                hasNaN = true;
                                break;
                            }
                        }
                        if (hasNaN) {
                            console.error(`      ERROR: Geometry contains NaN/Infinity values!`);
                        } else {
                            group.add(mesh);
                        }
                    } else {
                        console.error(`      ERROR: Invalid mesh geometry`);
                    }
                } catch (error) {
                    console.error(`      ERROR creating ${segment.type} geometry:`, error);
                }
            }
        }

        return group;
    }

    private segmentChain(chain: BackboneChain, secondaryStructure: SecondaryStructure): Segment[] {
        let segments: Segment[] = [];

        if (chain.caAtoms.length == 0) {
            return segments;
        }

        let currentType = secondaryStructure.getStructure(chain.chainID, chain.caAtoms[0].residueNumber);
        let startResidue = chain.caAtoms[0].residueNumber;
        let currSegment: Segment = { type: currentType, atoms: [chain.caAtoms[0]], startResidue, endResidue: -1, chainID: chain.chainID };

        for (let i = 1; i < chain.caAtoms.length; i++) {
            const prevAtom = chain.caAtoms[i - 1];
            const caAtom = chain.caAtoms[i];
            const atomType = secondaryStructure.getStructure(chain.chainID, caAtom.residueNumber);

            // Check for chain breaks (missing residues or large gaps)
            const residueGap = caAtom.residueNumber - prevAtom.residueNumber;
            const dx = caAtom.x - prevAtom.x;
            const dy = caAtom.y - prevAtom.y;
            const dz = caAtom.z - prevAtom.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Break segment if: residue gap > 1 OR distance > 4.5Å (typical CA-CA is ~3.8Å)
            const hasGap = residueGap > 1 || distance > 4.5;

            if (hasGap) {
                // Close current segment
                currSegment.endResidue = currSegment.atoms[currSegment.atoms.length - 1].residueNumber;
                segments.push(currSegment);
                console.warn(`    Chain break detected: residue ${prevAtom.residueNumber} → ${caAtom.residueNumber} (gap: ${residueGap}, dist: ${distance.toFixed(2)}Å)`);

                // Start new segment (without overlap)
                currentType = atomType;
                startResidue = caAtom.residueNumber;
                currSegment = { type: currentType, atoms: [caAtom], startResidue, endResidue: -1, chainID: chain.chainID };
            } else if (atomType == currentType) {
                // Continue current segment
                currSegment.atoms.push(caAtom);
            } else {
                // Secondary structure change (helix → sheet, etc.)
                currSegment.endResidue = currSegment.atoms[currSegment.atoms.length - 1].residueNumber;
                segments.push(currSegment);

                currentType = atomType;
                startResidue = caAtom.residueNumber;

                // Overlap segments by 1 atom for smooth transitions
                const lastAtomFromPrev = currSegment.atoms[currSegment.atoms.length - 1];
                currSegment = { type: currentType, atoms: [lastAtomFromPrev, caAtom], startResidue, endResidue: -1, chainID: chain.chainID };
            }
        }

        currSegment.endResidue = currSegment.atoms[currSegment.atoms.length - 1].residueNumber;
        segments.push(currSegment);

        return segments;
    } 

    private createLoopGeometry(segment: Segment, color: number): Mesh {
        const points = segment.atoms.map(atom => new Vector3(atom.x, atom.y, atom.z));

        // Validate points are not collinear/degenerate
        if (!this.validatePoints(points)) {
            console.warn(`      Skipping loop - invalid geometry (collinear points)`);
            // Return empty mesh
            return new Mesh(new BufferGeometry(), new MeshLambertMaterial({ color }));
        }

        const curve = new CatmullRomCurve3(points);
        const geometry = new TubeGeometry(
            curve,
            Math.max(16, this.detailLevel / 2),
            0.3,
            4,
            false,
        );

        const material = new MeshLambertMaterial({
            color: color,
            flatShading: true
        });
        return new Mesh(geometry, material);
    }
    
    private createHelixGeometry(segment: Segment, color: number): Mesh {
        const points = segment.atoms.map(atom => new Vector3(atom.x, atom.y, atom.z));

        // Validate points
        if (!this.validatePoints(points)) {
            console.warn(`      Skipping helix - invalid geometry (collinear points)`);
            return new Mesh(new BufferGeometry(), new MeshLambertMaterial({ color }));
        }

        const curve = new CatmullRomCurve3(points);
        const ribbonWidth = 2.5;
        const thickness = 0.4;
        const numSamples = this.detailLevel;
        const vertices: number[] = [];
        const indices: number[] = [];

        
        let previousUp = new Vector3(0, 1, 0); 
        for (let i = 0; i < numSamples; i++) {
            const t = i / (numSamples - 1);
            const position = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t).normalize();
            let up: Vector3;

            if (i === 0) {
                if (Math.abs(tangent.y) > 0.99) {
                    up = new Vector3(1, 0, 0).cross(tangent).normalize();
                } else {
                    up = new Vector3(0, 1, 0).cross(tangent).normalize();
                }
            } else {
                up = previousUp.clone()
                    .sub(tangent.clone().multiplyScalar(previousUp.dot(tangent))) 
                    .normalize(); 
            }
            
            const right = new Vector3().crossVectors(tangent, up).normalize();
            up = new Vector3().crossVectors(right, tangent).normalize();
            previousUp = up.clone();
            
            const halfWidth = ribbonWidth / 2;
            const halfThickness = thickness / 2;
            const topRight = position.clone()
                .add(right.clone().multiplyScalar(halfWidth))
                .add(up.clone().multiplyScalar(halfThickness));

            const topLeft = position.clone()
                .sub(right.clone().multiplyScalar(halfWidth))
                .add(up.clone().multiplyScalar(halfThickness));

            const bottomRight = position.clone()
                .add(right.clone().multiplyScalar(halfWidth))
                .sub(up.clone().multiplyScalar(halfThickness));

            const bottomLeft = position.clone()
                .sub(right.clone().multiplyScalar(halfWidth))
                .sub(up.clone().multiplyScalar(halfThickness));

            vertices.push(topRight.x, topRight.y, topRight.z);
            vertices.push(topLeft.x, topLeft.y, topLeft.z);
            vertices.push(bottomRight.x, bottomRight.y, bottomRight.z);
            vertices.push(bottomLeft.x, bottomLeft.y, bottomLeft.z);

            
            if (i > 0) {
                const prevTR = (i - 1) * 4 + 0; 
                const prevTL = (i - 1) * 4 + 1; 
                const prevBR = (i - 1) * 4 + 2; 
                const prevBL = (i - 1) * 4 + 3; 
                
                const currTR = i * 4 + 0;
                const currTL = i * 4 + 1;
                const currBR = i * 4 + 2;
                const currBL = i * 4 + 3;

                indices.push(prevTR, currTR, currTL);
                indices.push(prevTR, currTL, prevTL);

                
                indices.push(prevBR, currBL, currBR);
                indices.push(prevBR, prevBL, currBL);

                
                indices.push(prevTR, currBR, currTR);
                indices.push(prevTR, prevBR, currBR);

                
                indices.push(prevTL, currTL, currBL);
                indices.push(prevTL, currBL, prevBL);
            }
        }
        
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        const material = new MeshLambertMaterial({
            color: color,
            flatShading: true,
            precision: 'lowp'
        });
        const mesh = new Mesh(geometry, material);
        mesh.frustumCulled = true;

        return mesh;
    }

    private createSheetGeometry(segment: Segment, color: number): Mesh {
        const points = segment.atoms.map(atom => new Vector3(atom.x, atom.y, atom.z));

        // Validate points
        if (!this.validatePoints(points)) {
            console.warn(`      Skipping sheet - invalid geometry (collinear points)`);
            return new Mesh(new BufferGeometry(), new MeshLambertMaterial({ color }));
        }

        const curve = new CatmullRomCurve3(points);
        const bodyWidth = 3.0;        
        const arrowBaseWidth = bodyWidth * 1.15;   
        const thickness = 0.3;        
        const bodyEnd = 0.7;          
        const arrowStart = 0.76;       
        const arrowTipEnd = 1.0;      
        const numSamples = this.detailLevel; 
        const vertices: number[] = []; 
        const indices: number[] = [];  
        let previousUp = new Vector3(0, 1, 0); 

        
        for (let i = 0; i < numSamples; i++) {
            const t = i / (numSamples - 1);
            const position = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t).normalize();

            
            let up: Vector3;

            if (i === 0) {
                if (Math.abs(tangent.y) > 0.99) {
                    up = new Vector3(1, 0, 0).cross(tangent).normalize();
                } else {
                    up = new Vector3(0, 1, 0).cross(tangent).normalize();
                }
            } else {
                up = previousUp.clone()
                    .sub(tangent.clone().multiplyScalar(previousUp.dot(tangent))) 
                    .normalize(); 
            }

            
            const right = new Vector3().crossVectors(tangent, up).normalize();
            up = new Vector3().crossVectors(right, tangent).normalize();
            previousUp = up.clone();
            let width: number;

            if (t < bodyEnd) {
                width = bodyWidth;
            } else {
                const progress = (t - arrowStart) / (arrowTipEnd - arrowStart);
                width = arrowBaseWidth * (1.0 - progress);
            }

            const halfWidth = width / 2;
            const halfThickness = thickness / 2;
            const topRight = position.clone()
                .add(right.clone().multiplyScalar(halfWidth))
                .add(up.clone().multiplyScalar(halfThickness));

            const topLeft = position.clone()
                .sub(right.clone().multiplyScalar(halfWidth))
                .add(up.clone().multiplyScalar(halfThickness));

            const bottomRight = position.clone()
                .add(right.clone().multiplyScalar(halfWidth))
                .sub(up.clone().multiplyScalar(halfThickness));

            const bottomLeft = position.clone()
                .sub(right.clone().multiplyScalar(halfWidth))
                .sub(up.clone().multiplyScalar(halfThickness));

            
            vertices.push(topRight.x, topRight.y, topRight.z);
            vertices.push(topLeft.x, topLeft.y, topLeft.z);
            vertices.push(bottomRight.x, bottomRight.y, bottomRight.z);
            vertices.push(bottomLeft.x, bottomLeft.y, bottomLeft.z);

            
            if (i > 0) {
                
                const prevTR = (i - 1) * 4 + 0; 
                const prevTL = (i - 1) * 4 + 1; 
                const prevBR = (i - 1) * 4 + 2; 
                const prevBL = (i - 1) * 4 + 3;
                
                const currTR = i * 4 + 0;
                const currTL = i * 4 + 1;
                const currBR = i * 4 + 2;
                const currBL = i * 4 + 3;

                indices.push(prevTR, currTR, currTL);
                indices.push(prevTR, currTL, prevTL);

                indices.push(prevBR, currBL, currBR);
                indices.push(prevBR, prevBL, currBL);

                indices.push(prevTR, currBR, currTR);
                indices.push(prevTR, prevBR, currBR);

                indices.push(prevTL, currTL, currBL);
                indices.push(prevTL, currBL, prevBL);
            }
        }

        
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new MeshLambertMaterial({
            color: color,
            flatShading: true
        });
        const mesh = new Mesh(geometry, material);

        return mesh;
    }

    /**
     * Validate that points form a valid curve (not collinear, not degenerate)
     */
    private validatePoints(points: Vector3[]): boolean {
        if (points.length < 2) return false;

        // Check for duplicate/very close points
        for (let i = 1; i < points.length; i++) {
            const dist = points[i].distanceTo(points[i - 1]);
            if (dist < 0.01) {
                return false; // Points too close together
            }
        }

        // For 3+ points, check they're not collinear
        if (points.length >= 3) {
            // Check first 3 points form a triangle with non-zero area
            const v1 = new Vector3().subVectors(points[1], points[0]);
            const v2 = new Vector3().subVectors(points[2], points[0]);
            const cross = new Vector3().crossVectors(v1, v2);

            // If cross product is near zero, points are collinear
            if (cross.length() < 0.001) {
                return false;
            }
        }

        return true;
    }
};
