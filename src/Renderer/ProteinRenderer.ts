import { Box3, PerspectiveCamera, Scene, Vector3, InstancedMesh, Color, Group } from "three";
import { Protein } from "../PDBParser/Protein";
import { ColorDispatch, ColorMode, createAtomsMesh } from "./AtomRenderer";
import { createBondsMesh } from "./BondRenderer";
import { VDW_RADII } from "../Utils/VanDerWaals";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { RenderMode } from "./RenderMode";
import { ColorContext } from "./ColorContext";
import { CartoonRenderer } from "./CartoonRenderer";

export { RenderMode };

export class ProteinRenderer {
    atomMesh: InstancedMesh | null;
    bondMesh: InstancedMesh | null;
    cartoonMesh: Group | null;  
    colorContext: ColorContext | null;
    protein: Protein | null;
    scene: Scene;
    colorMode: ColorMode;
    renderMode: RenderMode;
    sphereDetail: number;
    cartoonRenderer: CartoonRenderer;

    boundingBox: Box3 | null;
    center: Vector3 | null;
    radius: number | null;

    constructor(scene: Scene) {
        this.atomMesh = null;
        this.bondMesh = null;
        this.cartoonMesh = null;
        this.protein = null;
        this.colorContext = null;
        this.colorMode = ColorMode.Element;
        this.renderMode = RenderMode.BallAndStick;
        this.sphereDetail = 16;
        this.scene = scene;
        this.cartoonRenderer = new CartoonRenderer();

        this.boundingBox = null;
        this.center = null;
        this.radius = null;
    }

    loadProtein(protein: Protein, renderMode: RenderMode = RenderMode.BallAndStick, colorMode: ColorMode = ColorMode.Element) {
        this.protein = protein;
        this.colorMode = colorMode;
        this.renderMode = renderMode;
        this.colorContext = new ColorContext(this.protein);
        this.colorContext.buildColorContext();
        this.initializeCenter();
        this.renderProtein();
    }

    clearProtein() {
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
        if (this.cartoonMesh) {
            this.scene.remove(this.cartoonMesh);
            // Dispose all meshes in the group
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

    private renderBallAndStick() {
        if (!this.protein) return;

        // Create atoms
        this.atomMesh = createAtomsMesh(this.protein.atoms, this.colorMode, 0.3, this.sphereDetail, this.sphereDetail);
        this.scene.add(this.atomMesh);

        // Create bonds
        if (this.protein.bonds.length > 0) {
            this.bondMesh = createBondsMesh(this.protein.atoms, this.protein.bonds);
            this.scene.add(this.bondMesh);
        }
    }

    private renderWireframe() {
        if (!this.protein) return;

        // Only bonds, no atoms
        if (this.protein.bonds.length > 0) {
            this.bondMesh = createBondsMesh(this.protein.atoms, this.protein.bonds);
            this.scene.add(this.bondMesh);
        }
    }

    private renderSpaceFill() {
        if (!this.protein) return;

        const maxRadius = Math.max(...this.protein.atoms.map(atom => VDW_RADII[atom.element] || 1.7));
        this.atomMesh = createAtomsMesh(this.protein.atoms, this.colorMode, maxRadius, this.sphereDetail, this.sphereDetail);
        this.scene.add(this.atomMesh);

        // No bonds in space-fill mode
    }

    private renderCartoon() {
        if (!this.protein || !this.colorContext) return;

        this.cartoonMesh = this.cartoonRenderer.createCartoonMesh(
            this.protein.backboneChains,
            this.protein.secondaryStructure,
            this.colorMode,
            this.colorContext
        );

        this.scene.add(this.cartoonMesh);
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

    updateColorMode(colorMode: ColorMode) {
        if (this.colorMode === colorMode || !this.atomMesh || !this.protein) {
            return;
        }

        const color = new Color();

        this.protein.atoms.forEach((atom, i) => {
            const colorValue = ColorDispatch[colorMode](atom);
            color.setHex(colorValue);
            this.atomMesh!.setColorAt(i, color);
        });

        // Tell GPU to re-upload colors
        if (this.atomMesh.instanceColor) {
            this.atomMesh.instanceColor.needsUpdate = true;
        }

        this.colorMode = colorMode;
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
        if (!this.boundingBox  ||
            !this.center||
            !this.radius ) {
            return;
        }
        
        camera.lookAt(this.center);
        // multiplied by 1.5 to add a bit of padding
        const distance = this.radius / Math.tan((camera.fov / 2) * (Math.PI / 180)) * 1.5;
        camera.position.set(
            this.center.x + distance,
            this.center.y + distance * 0.5,
            this.center.z + distance
        );

        controls.target.copy(this.center);
        controls.update();
    }
}