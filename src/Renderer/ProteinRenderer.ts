import { Box3, PerspectiveCamera, Scene, Vector3, InstancedMesh, Color, Group } from "three";
import { Protein } from "../Shared/Protein";
import { Atom } from "../Shared/Atom";
import { createAtomsMesh } from "./AtomRenderer";
import { createBondsMesh } from "./BondRenderer";
import { VDW_RADII } from "../Utils/VanDerWaals";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { RenderMode } from "./RenderMode";
import { ColorContext } from "./Color/ColorContext";
import { CartoonRenderer } from "./CartoonRenderer";
import { ColorSchemeRegistry } from "./Color/ColorSchemeRegistry";
import { ElementColorScheme } from "./Color/schemes/ElementColorScheme";
import { ChainColorScheme } from "./Color/schemes/ChainColorScheme";
import { ResidueColorScheme } from "./Color/schemes/ResidueColorScheme";
import { SecondaryStructureColorScheme } from "./Color/schemes/SecondaryStructureColorScheme";
import { RainbowColorScheme } from "./Color/schemes/RainbowColorScheme";
import { ColorScheme } from "./Color/ColorScheme";
import { isProteinAtom, isNucleicAcidAtom, isLigandAtom, isWaterAtom } from "../Utils/MoleculeTypes";
import { HydrophobicityColorScheme } from "./Color/schemes/HydrophobicityColorScheme";
import { BFactorColorScheme } from "./Color/schemes/BFactorColorScheme";
import { ElectrostaticColorScheme } from "./Color/schemes/ElectrostaticColorScheme";
import { DisulfideRenderer } from "./DisulfideRenderer";
import { CulledAtomRenderer } from "./CulledAtomRenderer";
import { ChunkedAtomRenderer } from "./ChunkedAtomRenderer";

export { RenderMode };

export class ProteinRenderer {
    private atomMesh: InstancedMesh | null;
    private bondMesh: InstancedMesh | null;
    private cartoonMesh: Group | null;
    private disulfideMesh: InstancedMesh | null;
    private colorContext: ColorContext | null;
    private protein: Protein | null;
    private scene: Scene;
    private currentColorScheme: ColorScheme | null;
    private renderMode: RenderMode;
    private sphereDetail: number;
    private cartoonRenderer: CartoonRenderer;
    private disulfideRenderer: DisulfideRenderer;
    private boundingBox: Box3 | null;
    private center: Vector3 | null;
    private radius: number | null;
    private colorSchemeRegistry: ColorSchemeRegistry;
    private showDisulfideBonds: boolean;
    private showWater: boolean;
    private waterMesh: InstancedMesh | null;
    private culledAtomRenderer: CulledAtomRenderer | null;
    private culledWaterRenderer: CulledAtomRenderer | null;
    private chunkedAtomRenderer: ChunkedAtomRenderer | null;
    private chunkedWaterRenderer: ChunkedAtomRenderer | null;
    private useFrustumCulling: boolean;
    private camera: PerspectiveCamera | null;
    private cullingThreshold: number;

    constructor(scene: Scene) {
        this.atomMesh = null;
        this.bondMesh = null;
        this.cartoonMesh = null;
        this.disulfideMesh = null;
        this.waterMesh = null;
        this.protein = null;
        this.colorContext = null;
        this.currentColorScheme = null;
        this.renderMode = RenderMode.BallAndStick;
        this.sphereDetail = 16;
        this.scene = scene;
        this.cartoonRenderer = new CartoonRenderer();
        this.disulfideRenderer = new DisulfideRenderer();
        this.showDisulfideBonds = true;
        this.showWater = false;
        this.culledAtomRenderer = null;
        this.culledWaterRenderer = null;
        this.chunkedAtomRenderer = null;
        this.chunkedWaterRenderer = null;
        this.useFrustumCulling = true;
        this.camera = null;
        this.cullingThreshold = 2000;
        this.colorSchemeRegistry = new ColorSchemeRegistry();


        const schemes = [
            new ElementColorScheme(),
            new ChainColorScheme(),
            new ResidueColorScheme(),
            new SecondaryStructureColorScheme(),
            new RainbowColorScheme(),
            new HydrophobicityColorScheme(),
            new BFactorColorScheme(),
            new ElectrostaticColorScheme()
        ];
        schemes.forEach(scheme => this.colorSchemeRegistry.registerColorScheme(scheme));
        
        this.boundingBox = null;
        this.center = null;
        this.radius = null;
    }

    loadProtein(protein: Protein, renderMode: RenderMode = RenderMode.BallAndStick, colorScheme?: ColorScheme) {
        this.protein = protein;
        this.renderMode = renderMode;
        this.colorContext = new ColorContext(this.protein);
        this.colorContext.buildColorContext();


        if (colorScheme) {
            this.currentColorScheme = colorScheme;
        } else {
            this.currentColorScheme = this.colorSchemeRegistry.get('element') || null;
        }

        this.initializeCenter();
        this.renderProtein();
    }

    clearProtein() {
        if (this.atomMesh) {
            this.scene.remove(this.atomMesh);
            this.atomMesh.dispose();
            this.atomMesh = null;
        }
        if (this.culledAtomRenderer) {
            const mesh = this.culledAtomRenderer.getMesh();
            if (mesh) {
                this.scene.remove(mesh);
            }
            this.culledAtomRenderer.dispose();
            this.culledAtomRenderer = null;
        }
        if (this.chunkedAtomRenderer) {
            this.chunkedAtomRenderer.dispose();
            this.chunkedAtomRenderer = null;
        }
        if (this.bondMesh) {
            this.scene.remove(this.bondMesh);
            this.bondMesh.dispose();
            this.bondMesh = null;
        }
        if (this.disulfideMesh) {
            this.scene.remove(this.disulfideMesh);
            this.disulfideMesh.dispose();
            this.disulfideMesh = null;
        }
        if (this.waterMesh) {
            this.scene.remove(this.waterMesh);
            this.waterMesh.dispose();
            this.waterMesh = null;
        }
        if (this.culledWaterRenderer) {
            const mesh = this.culledWaterRenderer.getMesh();
            if (mesh) {
                this.scene.remove(mesh);
            }
            this.culledWaterRenderer.dispose();
            this.culledWaterRenderer = null;
        }
        if (this.cartoonMesh) {
            this.scene.remove(this.cartoonMesh);

            this.cartoonMesh.traverse((child) => {
                if (child instanceof InstancedMesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.cartoonMesh = null;
        }
    }

    
    private filterAlternateConformations(atoms: Atom[]): Atom[] {
        const atomMap = new Map<string, Atom>();

        for (const atom of atoms) {

            const key = `${atom.chainID}-${atom.residueNumber}-${atom.atomName}`;
            const existing = atomMap.get(key);

            if (!existing) {
                atomMap.set(key, atom);
            } else {

                if (atom.altLoc && existing.altLoc) {

                    const atomOcc = atom.occupancy || 0;
                    const existingOcc = existing.occupancy || 0;

                    if (atomOcc > existingOcc || (atomOcc === existingOcc && atom.altLoc < existing.altLoc)) {
                        atomMap.set(key, atom);
                    }
                } else if (!atom.altLoc && existing.altLoc) {

                    atomMap.set(key, atom);
                }

            }
        }

        return Array.from(atomMap.values());
    }

    
    private renderDisulfideBonds() {
        if (!this.protein || !this.showDisulfideBonds) {
            return;
        }

        const disulfideBonds = this.disulfideRenderer.detectDisulfideBonds(this.protein.atoms);
        if (disulfideBonds.length > 0) {
            this.disulfideMesh = this.disulfideRenderer.createDisulfideBondsMesh(this.protein.atoms, disulfideBonds);
            if (this.disulfideMesh) {
                this.scene.add(this.disulfideMesh);
            }
        }
    }

    
    private renderWater() {
        if (!this.protein || !this.showWater || !this.currentColorScheme || !this.colorContext) {
            return;
        }


        const waterAtoms = this.protein.atoms.filter(isWaterAtom);
        if (waterAtoms.length === 0) {
            return;
        }

        console.log(`  Rendering ${waterAtoms.length} water molecules`);


        const filteredWater = this.filterAlternateConformations(waterAtoms);


        this.waterMesh = createAtomsMesh(
            filteredWater,
            this.currentColorScheme,
            this.colorContext,
            0.15,
            8,
            8
        );
        this.scene.add(this.waterMesh);
    }

    private renderBallAndStick() {
        if (!this.protein || !this.currentColorScheme || !this.colorContext) return;


        const nonWaterAtoms = this.protein.atoms.filter(atom => !isWaterAtom(atom));


        const filteredAtoms = this.filterAlternateConformations(nonWaterAtoms);


        const useChunking = this.useFrustumCulling && filteredAtoms.length > this.cullingThreshold;

        if (useChunking) {
            console.log(`  Using chunked rendering for ${filteredAtoms.length} atoms`);
            this.chunkedAtomRenderer = new ChunkedAtomRenderer(this.scene);
            this.chunkedAtomRenderer.initialize(
                filteredAtoms,
                this.currentColorScheme,
                this.colorContext,
                0.3,
                this.sphereDetail,
                this.sphereDetail
            );

        } else {

            this.atomMesh = createAtomsMesh(filteredAtoms, this.currentColorScheme, this.colorContext, 0.3, this.sphereDetail, this.sphereDetail);
            this.scene.add(this.atomMesh);
        }


        if (this.protein.bonds.length > 0) {
            this.bondMesh = createBondsMesh(this.protein.atoms, this.protein.bonds);
            this.scene.add(this.bondMesh);
        }


        this.renderDisulfideBonds();


        this.renderWater();
    }

    private renderWireframe() {
        if (!this.protein) return;


        if (this.protein.bonds.length > 0) {
            this.bondMesh = createBondsMesh(this.protein.atoms, this.protein.bonds);
            this.scene.add(this.bondMesh);
        }


        this.renderDisulfideBonds();


        this.renderWater();
    }

    private renderSpaceFill() {
        if (!this.protein || !this.currentColorScheme || !this.colorContext) return;


        const nonWaterAtoms = this.protein.atoms.filter(atom => !isWaterAtom(atom));


        const filteredAtoms = this.filterAlternateConformations(nonWaterAtoms);

        const maxRadius = Math.max(...filteredAtoms.map(atom => VDW_RADII[atom.element] || 1.7));



        let detail = this.sphereDetail;
        if (filteredAtoms.length > 20000) {
            detail = 4;
            console.warn(`  Space-fill mode on massive structure - using minimum detail (${detail}×${detail})`);
        } else if (filteredAtoms.length > 10000) {
            detail = 6;
            console.warn(`  Space-fill mode on large structure - using ultra-low detail (${detail}×${detail})`);
        } else if (filteredAtoms.length > 5000) {
            detail = 8;
        } else {
            detail = Math.min(this.sphereDetail, 12);
        }


        const useChunking = this.useFrustumCulling && filteredAtoms.length > this.cullingThreshold;

        if (useChunking) {
            console.log(`  Using chunked rendering for ${filteredAtoms.length} atoms (space-fill, detail: ${detail}×${detail})`);
            this.chunkedAtomRenderer = new ChunkedAtomRenderer(this.scene);
            this.chunkedAtomRenderer.initialize(
                filteredAtoms,
                this.currentColorScheme,
                this.colorContext,
                maxRadius,
                detail,
                detail
            );
        } else {
            this.atomMesh = createAtomsMesh(filteredAtoms, this.currentColorScheme, this.colorContext, maxRadius, detail, detail);
            this.scene.add(this.atomMesh);
        }


        this.renderDisulfideBonds();
        this.renderWater();
    }

    private renderCartoon() {
        if (!this.protein || !this.colorContext || !this.currentColorScheme) return;


        this.cartoonMesh = this.cartoonRenderer.createCartoonMesh(
            this.protein.backboneChains,
            this.protein.secondaryStructure,
            this.currentColorScheme,
            this.colorContext
        );
        this.scene.add(this.cartoonMesh);



        const nonProteinAtoms = this.protein.atoms.filter(atom =>
            !isProteinAtom(atom) && atom.residueName !== 'HOH' && atom.residueName !== 'WAT'
        );

        if (nonProteinAtoms.length > 0) {
            const nucleicAcids = nonProteinAtoms.filter(isNucleicAcidAtom);
            const ligands = nonProteinAtoms.filter(isLigandAtom);

            console.log(`  Rendering in cartoon mode: ${nucleicAcids.length} nucleic acid atoms, ${ligands.length} ligand atoms`);


            const filteredNonProteinAtoms = this.filterAlternateConformations(nonProteinAtoms);


            this.atomMesh = createAtomsMesh(
                filteredNonProteinAtoms,
                this.currentColorScheme,
                this.colorContext,
                0.3,
                this.sphereDetail,
                this.sphereDetail
            );
            this.scene.add(this.atomMesh);



            const nonProteinIndices = new Set<number>();
            this.protein.atoms.forEach((atom, index) => {
                if (!isProteinAtom(atom)) {
                    nonProteinIndices.add(index);
                }
            });

            const nonProteinBonds = this.protein.bonds.filter(([index1, index2]) =>
                nonProteinIndices.has(index1) && nonProteinIndices.has(index2)
            );

            if (nonProteinBonds.length > 0) {
                this.bondMesh = createBondsMesh(this.protein.atoms, nonProteinBonds);
                this.scene.add(this.bondMesh);
            }
        }


        this.renderDisulfideBonds();


        this.renderWater();
    }

    private renderProtein() {
        this.clearProtein();

        switch (this.renderMode) {
            case RenderMode.BallAndStick:
                this.renderBallAndStick();
                break;
            case RenderMode.Wireframe:
                this.renderWireframe();
                break;
            case RenderMode.SpaceFill:
                this.renderSpaceFill();
                break;
            case RenderMode.Cartoon:
                this.renderCartoon();
                break;
        }
    }



    updateRenderMode(renderMode: RenderMode) {
        if (this.renderMode === renderMode || !this.protein) {
            return;
        }

        this.renderMode = renderMode;
        this.renderProtein();
    }

    setSphereDetail(detail: number) {
        this.sphereDetail = detail;
        if (this.protein) {
            this.renderProtein();
        }
    }

    private initializeCenter() {
        if (!this.protein) {
            return;
        }

        this.boundingBox = new Box3();
        this.protein.atoms.forEach((atom) => {
            this.boundingBox?.expandByPoint(new Vector3(atom.x, atom.y, atom.z))
        });
        this.center = new Vector3();
        this.boundingBox.getCenter(this.center);
        
        const size = new Vector3();
        this.boundingBox.getSize(size);
        this.radius = size.length() / 2;
    }

    centerCamera(camera: PerspectiveCamera, controls: OrbitControls) {

        this.camera = camera;

        if (!this.boundingBox  ||
            !this.center||
            !this.radius ) {
            return;
        }

        camera.lookAt(this.center);

        const distance = this.radius / Math.tan((camera.fov / 2) * (Math.PI / 180)) * 1.5;
        camera.position.set(
            this.center.x + distance,
            this.center.y + distance * 0.5,
            this.center.z + distance
        );

        controls.target.copy(this.center);
        controls.update();


        if (this.camera) {
            this.updateCulling();
        }
    }

    
    public hasProtein(): boolean {
        return this.protein !== null;
    }

    
    public getColorSchemeRegistry(): ColorSchemeRegistry {
        return this.colorSchemeRegistry;
    }

    
    public recolorProtein(scheme: ColorScheme): void {
        if (!this.protein || !this.colorContext) {
            return;
        }


        this.currentColorScheme = scheme;


        if (this.atomMesh && (this.renderMode === RenderMode.BallAndStick ||
            this.renderMode === RenderMode.Wireframe ||
            this.renderMode === RenderMode.SpaceFill)) {

            const color = new Color();
            for (let i = 0; i < this.protein.atoms.length; i++) {
                const atom = this.protein.atoms[i];
                const hexColor = scheme.getColor(atom, this.colorContext) as number;
                color.setHex(hexColor);
                this.atomMesh.setColorAt(i, color);
            }


            if (this.atomMesh.instanceColor) {
                this.atomMesh.instanceColor.needsUpdate = true;
            }
        }


        if (this.renderMode === RenderMode.Cartoon) {

            if (this.cartoonMesh) {
                this.scene.remove(this.cartoonMesh);
                this.cartoonMesh.traverse((child) => {
                    if (child instanceof InstancedMesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                this.cartoonMesh = null;
            }


            if (this.atomMesh) {
                this.scene.remove(this.atomMesh);
                this.atomMesh.dispose();
                this.atomMesh = null;
            }
            if (this.bondMesh) {
                this.scene.remove(this.bondMesh);
                this.bondMesh.dispose();
                this.bondMesh = null;
            }

            this.renderCartoon();
        }
    }

    
    public getColorContext(): ColorContext | null {
        return this.colorContext;
    }

    
    public getRenderMode(): RenderMode {
        return this.renderMode;
    }

    
    public setShowDisulfideBonds(show: boolean): void {
        if (this.showDisulfideBonds === show) {
            return;
        }

        this.showDisulfideBonds = show;


        if (this.protein) {
            this.renderProtein();
        }
    }

    
    public getShowDisulfideBonds(): boolean {
        return this.showDisulfideBonds;
    }

    
    public setShowWater(show: boolean): void {
        if (this.showWater === show) {
            return;
        }

        this.showWater = show;


        if (this.protein) {
            this.renderProtein();
        }
    }

    
    public getShowWater(): boolean {
        return this.showWater;
    }

    
    public updateCulling(): void {
        if (!this.camera) return;


        if (this.chunkedAtomRenderer) {
            this.chunkedAtomRenderer.updateVisibility(this.camera);
        }

        if (this.chunkedWaterRenderer) {
            this.chunkedWaterRenderer.updateVisibility(this.camera);
        }


        if (this.culledAtomRenderer) {
            this.culledAtomRenderer.updateVisibility(this.camera);
        }

        if (this.culledWaterRenderer) {
            this.culledWaterRenderer.updateVisibility(this.camera);
        }
    }

    
    public setUseFrustumCulling(use: boolean): void {
        if (this.useFrustumCulling === use) {
            return;
        }

        this.useFrustumCulling = use;


        if (this.protein) {
            this.renderProtein();
        }
    }

    
    public getUseFrustumCulling(): boolean {
        return this.useFrustumCulling;
    }

    
    public setCullingThreshold(threshold: number): void {
        this.cullingThreshold = threshold;
    }

    
    public getCullingStats(): { visible: number, total: number, chunks?: number, enabled: boolean } | null {
        if (this.chunkedAtomRenderer) {
            return {
                visible: this.chunkedAtomRenderer.getVisibleCount(),
                total: this.chunkedAtomRenderer.getTotalCount(),
                chunks: this.chunkedAtomRenderer.getChunkCount(),
                enabled: true
            };
        }
        if (this.culledAtomRenderer) {
            return {
                visible: this.culledAtomRenderer.getVisibleCount(),
                total: this.culledAtomRenderer.getTotalCount(),
                enabled: true
            };
        }
        return null;
    }
}