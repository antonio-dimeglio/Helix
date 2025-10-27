import { lerp } from "three/src/math/MathUtils.js";
import { Atom } from "../PDBParser/Atom";
import { BackboneChain } from "../PDBParser/Protein";
import { StructureType, SecondaryStructure } from "../PDBParser/SecondaryStructure";
import { ColorMode } from "./AtomRenderer";
import { ColorContext } from "./ColorContext";
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
        colorMode: ColorMode,
        colorContext: ColorContext
    ): Group {
        const group = new Group();
        const totalAtoms = backboneChains.reduce((sum, chain) => sum + chain.caAtoms.length, 0);
        if (totalAtoms > 1000) {
            this.detailLevel = 24;  
        } else if (totalAtoms > 500) {
            this.detailLevel = 32;  
        } else {
            this.detailLevel = 48;  
        }
        console.log(`Rendering with detail level: ${this.detailLevel} (${totalAtoms} CA atoms)`);

        
        for (const chain of backboneChains) {
            const segments = this.segmentChain(chain, secondaryStructure);
            for (const segment of segments) {
                if (segment.atoms.length < 2) {
                    console.log(`Skipping ${segment.type} segment - too few atoms (${segment.atoms.length})`);
                    continue;
                }

                let mesh: Mesh;
                switch (segment.type) {
                    case StructureType.Loop:
                        mesh = this.createLoopGeometry(segment);
                        break;
                    case StructureType.Helix:
                        mesh = this.createHelixGeometry(segment);
                        break;
                    case StructureType.Sheet:
                        mesh = this.createSheetGeometry(segment);
                        break;
                    default:
                        mesh = this.createLoopGeometry(segment);
                        break;
                }
                
                group.add(mesh);
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
        console.log(`Chain ${chain.chainID}, first residue ${chain.caAtoms[0].residueNumber}: ${currentType}`);
        let startResidue = chain.caAtoms[0].residueNumber;
        let currSegment: Segment = { type: currentType, atoms: [chain.caAtoms[0]], startResidue, endResidue: -1, chainID: chain.chainID };

        for (let i = 1; i < chain.caAtoms.length; i++) {
            const caAtom = chain.caAtoms[i];
            const atomType = secondaryStructure.getStructure(chain.chainID, caAtom.residueNumber);
            console.log(`  Residue ${caAtom.residueNumber}: ${atomType}`);

            if (atomType == currentType) {
                currSegment.atoms.push(caAtom);
            } else {
                currSegment.endResidue = currSegment.atoms[currSegment.atoms.length - 1].residueNumber;
                segments.push(currSegment);

                currentType = atomType;
                startResidue = caAtom.residueNumber;
                
                const lastAtomFromPrev = currSegment.atoms[currSegment.atoms.length - 1];
                currSegment = { type: currentType, atoms: [lastAtomFromPrev, caAtom], startResidue, endResidue: -1, chainID: chain.chainID };
            }

        }

        currSegment.endResidue = currSegment.atoms[currSegment.atoms.length - 1].residueNumber;
        segments.push(currSegment);

        return segments; 
    } 

    private createLoopGeometry(segment: Segment): Mesh {
        const points = segment.atoms.map(atom => new Vector3(atom.x, atom.y, atom.z));
        const curve = new CatmullRomCurve3(points);
        const geometry = new TubeGeometry(
            curve,
            Math.max(16, this.detailLevel / 2), 
            0.3, 
            4, 
            false, 
        );

        const material = new MeshLambertMaterial({
            color: 0x00ff00,
            flatShading: true  
        });
        return new Mesh(geometry, material);
    }
    
    private createHelixGeometry(segment: Segment): Mesh {
        
        const points = segment.atoms.map(atom => new Vector3(atom.x, atom.y, atom.z));
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
            color: 0xff0000,
            flatShading: true,
            precision: 'lowp'  
        });
        const mesh = new Mesh(geometry, material);
        mesh.frustumCulled = true;  

        return mesh;
    }

    private createSheetGeometry(segment: Segment): Mesh {
        const points = segment.atoms.map(atom => new Vector3(atom.x, atom.y, atom.z));
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
            color: 0x0000ff,
            flatShading: true  
        });
        const mesh = new Mesh(geometry, material);

        return mesh;
    }
};
