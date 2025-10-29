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

interface ProteinRenderData {
    proteinId: string;
    protein: Protein;
    atomMesh: InstancedMesh | null;
    bondMesh: InstancedMesh | null;
    cartoonMesh: Group | null;
    disulfideMesh: InstancedMesh | null;
    waterMesh: InstancedMesh | null;
    chunkedAtomRenderer: ChunkedAtomRenderer | null;
    chunkedWaterRenderer: ChunkedAtomRenderer | null;
    colorContext: ColorContext;
    colorScheme: ColorScheme;
    renderMode: RenderMode;
    spatialOffset: Vector3;
}

export class ProteinRenderer {
    private atomMesh: InstancedMesh | null;
    private bondMesh: InstancedMesh | null;
    private cartoonMesh: Group | null;
    private disulfideMesh: InstancedMesh | null;
    private colorContext: ColorContext | null;
    private protein: Protein | null;
    private loadedProteins: Map<string, ProteinRenderData>;
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
        this.loadedProteins = new Map();
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

        this.recalculateSceneBounds();

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

    public applyColorSchemeToProtein(proteinId: string, colorScheme: ColorScheme): boolean {
        const renderData = this.loadedProteins.get(proteinId);
        if (!renderData) {
            console.warn(`Cannot apply color scheme to protein ${proteinId}: not found`);
            return false;
        }

        // Store the new color scheme
        renderData.colorScheme = colorScheme;

        // Re-render the protein with the new color scheme
        this.renderProteinById(proteinId, renderData.renderMode, colorScheme);

        // Reapply the stored spatial offset
        this.applyOffsetToProtein(proteinId, renderData.spatialOffset);

        console.log(`Applied color scheme ${colorScheme.id} to protein ${proteinId} at offset ${renderData.spatialOffset.toArray()}`);
        return true;
    }

    public getProteinColorScheme(proteinId: string): ColorScheme | null {
        const renderData = this.loadedProteins.get(proteinId);
        return renderData ? renderData.colorScheme : null;
    }

    public getProteinRenderMode(proteinId: string): RenderMode | null {
        const renderData = this.loadedProteins.get(proteinId);
        return renderData ? renderData.renderMode : null;
    }

    public getProteinColorContext(proteinId: string): ColorContext | null {
        const renderData = this.loadedProteins.get(proteinId);
        return renderData ? renderData.colorContext : null;
    }

    focusOnProtein(proteinId: string, camera: PerspectiveCamera, controls: OrbitControls): boolean {
        const renderData = this.loadedProteins.get(proteinId);
        if (!renderData) {
            console.warn(`Cannot focus on protein ${proteinId}: not found`);
            return false;
        }

        this.camera = camera;

        const proteinBox = new Box3();
        renderData.protein.atoms.forEach(atom => {
            proteinBox.expandByPoint(new Vector3(atom.x, atom.y, atom.z));
        });

        // Use the stored spatial offset
        const offset = renderData.spatialOffset;

        const min = proteinBox.min.clone().add(offset);
        const max = proteinBox.max.clone().add(offset);
        const adjustedBox = new Box3(min, max);

        const center = new Vector3();
        adjustedBox.getCenter(center);

        const size = new Vector3();
        adjustedBox.getSize(size);
        const radius = size.length() / 2;

        camera.lookAt(center);

        const distance = radius / Math.tan((camera.fov / 2) * (Math.PI / 180)) * 1.5;
        camera.position.set(
            center.x + distance,
            center.y + distance * 0.5,
            center.z + distance
        );

        controls.target.copy(center);
        controls.update();

        if (this.camera) {
            this.updateCulling();
        }

        console.log(`Focused on protein ${proteinId} at position ${offset.toArray()}`);
        return true;
    }

    private recalculateSceneBounds(): void {
        const allProteins = Array.from(this.loadedProteins.values());

        if (allProteins.length === 0) {
            if (this.protein) {
                return;
            }
            this.boundingBox = null;
            this.center = null;
            this.radius = null;
            return;
        }

        const sceneBounds = new Box3();

        allProteins.forEach(renderData => {
            const proteinBox = new Box3();
            renderData.protein.atoms.forEach(atom => {
                proteinBox.expandByPoint(new Vector3(atom.x, atom.y, atom.z));
            });

            if (renderData.atomMesh) {
                const offset = renderData.atomMesh.position;
                const min = proteinBox.min.clone().add(offset);
                const max = proteinBox.max.clone().add(offset);
                sceneBounds.expandByPoint(min);
                sceneBounds.expandByPoint(max);
            } else if (renderData.cartoonMesh) {
                const offset = renderData.cartoonMesh.position;
                const min = proteinBox.min.clone().add(offset);
                const max = proteinBox.max.clone().add(offset);
                sceneBounds.expandByPoint(min);
                sceneBounds.expandByPoint(max);
            } else {
                sceneBounds.union(proteinBox);
            }
        });

        this.boundingBox = sceneBounds;
        this.center = new Vector3();
        sceneBounds.getCenter(this.center);

        const size = new Vector3();
        sceneBounds.getSize(size);
        this.radius = size.length() / 2;

        console.log(`Scene bounds updated: center=${this.center.toArray()}, radius=${this.radius.toFixed(2)}`);
    }

    
    public hasProtein(): boolean {
        return this.protein !== null;
    }

    public addProteinToScene(proteinId: string, protein: Protein, renderMode: RenderMode): void {
        if (this.loadedProteins.has(proteinId)) {
            console.warn(`Protein ${proteinId} already in scene`);
            return;
        }

        const colorContext = new ColorContext(protein);

        // For small molecules (few atoms, no chains), always use element coloring
        const isSmallMolecule = protein.atoms.length < 100 && protein.numChains === 1;
        const colorScheme = isSmallMolecule
            ? new ElementColorScheme()
            : (this.currentColorScheme || new ElementColorScheme());

        const spatialOffset = this.calculateSpatialOffset(protein);

        const renderData: ProteinRenderData = {
            proteinId,
            protein,
            atomMesh: null,
            bondMesh: null,
            cartoonMesh: null,
            disulfideMesh: null,
            waterMesh: null,
            chunkedAtomRenderer: null,
            chunkedWaterRenderer: null,
            colorContext,
            colorScheme,
            renderMode,
            spatialOffset
        };

        this.loadedProteins.set(proteinId, renderData);

        this.renderProteinById(proteinId, renderMode, colorScheme);

        this.applyOffsetToProtein(proteinId, spatialOffset);
    }

    private calculateSpatialOffset(protein: Protein): Vector3 {
        const existingProteins = Array.from(this.loadedProteins.values());

        if (existingProteins.length === 0) {
            return new Vector3(0, 0, 0);
        }

        const proteinBox = new Box3();
        protein.atoms.forEach(atom => {
            proteinBox.expandByPoint(new Vector3(atom.x, atom.y, atom.z));
        });

        const proteinSize = new Vector3();
        proteinBox.getSize(proteinSize);
        const maxDimension = Math.max(proteinSize.x, proteinSize.y, proteinSize.z);

        const separationDistance = maxDimension * 2.5;

        const offsetX = existingProteins.length * separationDistance;

        return new Vector3(offsetX, 0, 0);
    }

    private applyOffsetToProtein(proteinId: string, offset: Vector3): void {
        const renderData = this.loadedProteins.get(proteinId);
        if (!renderData) return;

        if (renderData.atomMesh) {
            renderData.atomMesh.position.copy(offset);
        }
        if (renderData.bondMesh) {
            renderData.bondMesh.position.copy(offset);
        }
        if (renderData.cartoonMesh) {
            renderData.cartoonMesh.position.copy(offset);
        }
        if (renderData.disulfideMesh) {
            renderData.disulfideMesh.position.copy(offset);
        }
        if (renderData.waterMesh) {
            renderData.waterMesh.position.copy(offset);
        }
    }

    private renderProteinById(proteinId: string, renderMode: RenderMode, colorScheme: ColorScheme): void {
        const renderData = this.loadedProteins.get(proteinId);
        if (!renderData) return;

        const protein = renderData.protein;
        const colorContext = renderData.colorContext;

        this.clearProteinMeshes(proteinId);

        switch (renderMode) {
            case RenderMode.BallAndStick:
                this.renderBallAndStickForProtein(renderData, colorScheme);
                break;
            case RenderMode.Wireframe:
                this.renderWireframeForProtein(renderData, colorScheme);
                break;
            case RenderMode.SpaceFill:
                this.renderSpaceFillForProtein(renderData, colorScheme);
                break;
            case RenderMode.Cartoon:
                this.renderCartoonForProtein(renderData, colorScheme);
                break;
        }
    }

    private clearProteinMeshes(proteinId: string): void {
        const renderData = this.loadedProteins.get(proteinId);
        if (!renderData) return;

        if (renderData.atomMesh) {
            this.scene.remove(renderData.atomMesh);
            renderData.atomMesh.geometry.dispose();
            (renderData.atomMesh.material as any).dispose();
            renderData.atomMesh = null;
        }

        if (renderData.bondMesh) {
            this.scene.remove(renderData.bondMesh);
            renderData.bondMesh.geometry.dispose();
            (renderData.bondMesh.material as any).dispose();
            renderData.bondMesh = null;
        }

        if (renderData.cartoonMesh) {
            this.scene.remove(renderData.cartoonMesh);
            renderData.cartoonMesh = null;
        }

        if (renderData.disulfideMesh) {
            this.scene.remove(renderData.disulfideMesh);
            renderData.disulfideMesh.geometry.dispose();
            (renderData.disulfideMesh.material as any).dispose();
            renderData.disulfideMesh = null;
        }

        if (renderData.waterMesh) {
            this.scene.remove(renderData.waterMesh);
            renderData.waterMesh.geometry.dispose();
            (renderData.waterMesh.material as any).dispose();
            renderData.waterMesh = null;
        }
    }

    private renderBallAndStickForProtein(renderData: ProteinRenderData, colorScheme: ColorScheme): void {
        const protein = renderData.protein;
        const filteredAtoms = protein.atoms.filter(atom => !isWaterAtom(atom));

        renderData.atomMesh = createAtomsMesh(filteredAtoms, colorScheme, renderData.colorContext, 0.3);
        if (renderData.atomMesh) this.scene.add(renderData.atomMesh);

        renderData.bondMesh = createBondsMesh(protein.atoms, protein.bonds);
        if (renderData.bondMesh) this.scene.add(renderData.bondMesh);

        if (this.showDisulfideBonds) {
            const disulfideBonds = this.disulfideRenderer.detectDisulfideBonds(protein.atoms);
            renderData.disulfideMesh = this.disulfideRenderer.createDisulfideBondsMesh(protein.atoms, disulfideBonds);
            if (renderData.disulfideMesh) this.scene.add(renderData.disulfideMesh);
        }
    }

    private renderWireframeForProtein(renderData: ProteinRenderData, colorScheme: ColorScheme): void {
        const protein = renderData.protein;

        renderData.bondMesh = createBondsMesh(protein.atoms, protein.bonds);
        if (renderData.bondMesh) this.scene.add(renderData.bondMesh);

        if (this.showDisulfideBonds) {
            const disulfideBonds = this.disulfideRenderer.detectDisulfideBonds(protein.atoms);
            renderData.disulfideMesh = this.disulfideRenderer.createDisulfideBondsMesh(protein.atoms, disulfideBonds);
            if (renderData.disulfideMesh) this.scene.add(renderData.disulfideMesh);
        }
    }

    private renderSpaceFillForProtein(renderData: ProteinRenderData, colorScheme: ColorScheme): void {
        const protein = renderData.protein;
        const filteredAtoms = protein.atoms.filter(atom => !isWaterAtom(atom));

        const maxRadius = Math.max(...filteredAtoms.map(atom => VDW_RADII[atom.element] || 1.7));

        renderData.atomMesh = createAtomsMesh(filteredAtoms, colorScheme, renderData.colorContext, maxRadius);
        if (renderData.atomMesh) this.scene.add(renderData.atomMesh);

        if (this.showDisulfideBonds) {
            const disulfideBonds = this.disulfideRenderer.detectDisulfideBonds(protein.atoms);
            renderData.disulfideMesh = this.disulfideRenderer.createDisulfideBondsMesh(protein.atoms, disulfideBonds);
            if (renderData.disulfideMesh) this.scene.add(renderData.disulfideMesh);
        }
    }

    private renderCartoonForProtein(renderData: ProteinRenderData, colorScheme: ColorScheme): void {
        const protein = renderData.protein;
        renderData.cartoonMesh = this.cartoonRenderer.createCartoonMesh(
            protein.backboneChains,
            protein.secondaryStructure,
            colorScheme,
            renderData.colorContext
        );
        if (renderData.cartoonMesh) this.scene.add(renderData.cartoonMesh);

        if (this.showDisulfideBonds) {
            const disulfideBonds = this.disulfideRenderer.detectDisulfideBonds(protein.atoms);
            renderData.disulfideMesh = this.disulfideRenderer.createDisulfideBondsMesh(protein.atoms, disulfideBonds);
            if (renderData.disulfideMesh) this.scene.add(renderData.disulfideMesh);
        }
    }

    public removeProteinFromScene(proteinId: string): void {
        const renderData = this.loadedProteins.get(proteinId);
        if (!renderData) {
            console.warn(`Protein ${proteinId} not found in scene`);
            return;
        }

        if (renderData.atomMesh) {
            this.scene.remove(renderData.atomMesh);
            renderData.atomMesh.geometry.dispose();
            (renderData.atomMesh.material as any).dispose();
        }

        if (renderData.bondMesh) {
            this.scene.remove(renderData.bondMesh);
            renderData.bondMesh.geometry.dispose();
            (renderData.bondMesh.material as any).dispose();
        }

        if (renderData.cartoonMesh) {
            this.scene.remove(renderData.cartoonMesh);
            renderData.cartoonMesh.traverse((child) => {
                if (child instanceof InstancedMesh) {
                    child.geometry.dispose();
                    (child.material as any).dispose();
                }
            });
        }

        if (renderData.disulfideMesh) {
            this.scene.remove(renderData.disulfideMesh);
            renderData.disulfideMesh.geometry.dispose();
            (renderData.disulfideMesh.material as any).dispose();
        }

        if (renderData.waterMesh) {
            this.scene.remove(renderData.waterMesh);
            renderData.waterMesh.geometry.dispose();
            (renderData.waterMesh.material as any).dispose();
        }

        if (renderData.chunkedAtomRenderer) {
            renderData.chunkedAtomRenderer.dispose();
        }

        if (renderData.chunkedWaterRenderer) {
            renderData.chunkedWaterRenderer.dispose();
        }

        this.loadedProteins.delete(proteinId);
        console.log(`Removed protein ${proteinId} from scene and memory`);
    }

    public setProteinVisibility(proteinId: string, visible: boolean): void {
        const renderData = this.loadedProteins.get(proteinId);
        if (!renderData) return;

        if (renderData.atomMesh) renderData.atomMesh.visible = visible;
        if (renderData.bondMesh) renderData.bondMesh.visible = visible;
        if (renderData.cartoonMesh) renderData.cartoonMesh.visible = visible;
        if (renderData.disulfideMesh) renderData.disulfideMesh.visible = visible;
        if (renderData.waterMesh) renderData.waterMesh.visible = visible;
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