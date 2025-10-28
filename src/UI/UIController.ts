import { PerspectiveCamera, WebGLRenderer, Scene } from "three";
import { ProteinRenderer, RenderMode } from "../Renderer/ProteinRenderer";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { PDBParser } from "../Parser/PDBParser/PDBParser";
import { CIFParser } from "../Parser/CIFParser/CIFParser";
import { Protein } from "../Shared/Protein";
import { ColorUIController } from "./ColorUIController";

export class UIController {
    private proteinRenderer: ProteinRenderer;
    private renderer: WebGLRenderer;
    private scene: Scene;
    private camera: PerspectiveCamera;
    private controls: OrbitControls;
    private colorUIController: ColorUIController | null;

    private fpsDisplay!: HTMLElement;
    private atomCountDisplay!: HTMLElement;
    private bondCountDisplay!: HTMLElement;
    private chainCountDisplay!: HTMLElement;
    private residueCountDisplay!: HTMLElement;
    private proteinNameDisplay!: HTMLElement;
    private statusText!: HTMLElement;
    private statusIndicator!: HTMLElement;
    private renderModeStatus!: HTMLElement;
    private qualityStatus!: HTMLElement;

    private renderSelect!: HTMLSelectElement;
    private pdbFileInput!: HTMLInputElement;
    private uploadArea!: HTMLDivElement;
    private pdbSearchInput!: HTMLInputElement;
    private fetchBtn!: HTMLButtonElement;
    private resetCameraBtn!: HTMLButtonElement;
    private exportBtn!: HTMLButtonElement;
    private qualityPresetSelect!: HTMLSelectElement;
    private autoQualityCheckbox!: HTMLInputElement;
    private frustumCullingCheckbox!: HTMLInputElement;
    private showDisulfideBondsCheckbox!: HTMLInputElement;
    private showWaterCheckbox!: HTMLInputElement;

    constructor(
    proteinRenderer: ProteinRenderer,
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    controls: OrbitControls
    ) {
        this.proteinRenderer = proteinRenderer;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.colorUIController = null;

        this.initializeElements();
        this.attachEventListeners();
    }

    public setColorUIController(colorUIController: ColorUIController): void {
        this.colorUIController = colorUIController;
    }

    private initializeElements() {
        this.fpsDisplay = document.getElementById('fps')!;
        this.atomCountDisplay = document.getElementById('atomCount')!;
        this.bondCountDisplay = document.getElementById('bondCount')!;
        this.chainCountDisplay = document.getElementById('chainCount')!;
        this.residueCountDisplay = document.getElementById('residueCount')!;
        this.proteinNameDisplay = document.getElementById('proteinName')!;
        this.statusText = document.getElementById('statusText')!;
        this.statusIndicator = document.getElementById('statusIndicator')!;
        this.renderModeStatus = document.getElementById('renderModeStatus')!;
        this.qualityStatus = document.getElementById('qualityStatus')!;

        this.renderSelect = document.getElementById("renderSelect") as HTMLSelectElement;
        this.pdbFileInput = document.getElementById("pdbFileInput") as HTMLInputElement;
        this.uploadArea = document.getElementById("uploadArea") as HTMLDivElement;
        this.pdbSearchInput = document.getElementById("pdbInput") as HTMLInputElement;
        this.fetchBtn = document.getElementById("fetchBtn") as HTMLButtonElement;
        this.resetCameraBtn = document.getElementById("resetCameraBtn") as HTMLButtonElement;
        this.exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
        this.qualityPresetSelect = document.getElementById("qualityPresetSelect") as HTMLSelectElement;
        this.autoQualityCheckbox = document.getElementById("autoQualityCheckbox") as HTMLInputElement;
        this.frustumCullingCheckbox = document.getElementById("frustumCullingCheckbox") as HTMLInputElement;
        this.showDisulfideBondsCheckbox = document.getElementById("showDisulfideBondsCheckbox") as HTMLInputElement;
        this.showWaterCheckbox = document.getElementById("showWaterCheckbox") as HTMLInputElement;
    }

    private attachEventListeners() {
        this.fetchBtn.addEventListener('click', async () => {
            const pdbId = this.pdbSearchInput.value.trim().toLowerCase();
            if (!pdbId) {
                alert('Please enter a PDB ID');
                return;
            }

            if (this.fetchBtn.disabled) {
                return;
            }
            this.fetchBtn.disabled = true;
            this.fetchBtn.textContent = 'Fetching...';

            try {
                await this.fetchProteinFromRCSB(pdbId);
            } finally {
                this.fetchBtn.disabled = false;
                this.fetchBtn.textContent = 'Fetch';
            }
        });

        this.pdbSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.fetchBtn.click();
            }
        });

        this.renderSelect.addEventListener('change', () => {
            const newMode = this.renderSelect.value as RenderMode;
            this.onRenderModeChange(newMode);
        });

        this.qualityPresetSelect.addEventListener('change', () => {
            this.onQualityPresetChange();
        });

        this.frustumCullingCheckbox.addEventListener('change', () => {
            this.proteinRenderer.setUseFrustumCulling(this.frustumCullingCheckbox.checked);
        });

        this.showDisulfideBondsCheckbox.addEventListener('change', () => {
            this.proteinRenderer.setShowDisulfideBonds(this.showDisulfideBondsCheckbox.checked);
        });

        this.showWaterCheckbox.addEventListener('change', () => {
            this.proteinRenderer.setShowWater(this.showWaterCheckbox.checked);
        });

        this.resetCameraBtn.addEventListener('click', () => {
            this.proteinRenderer.centerCamera(this.camera, this.controls);
        });

        this.exportBtn.addEventListener('click', () => {
            this.exportImage();
        });

        this.uploadArea.addEventListener('click', () => {
            this.pdbFileInput.click();
        });

        this.pdbFileInput.addEventListener('change', (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                const fileName = file.name.replace(/\.(pdb|cif|mmcif)$/i, '');
                this.loadProteinFromContent(content, fileName);
            };
            reader.readAsText(file);
        });

        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = 'var(--accent-primary)';
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.style.borderColor = '';
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = '';

            const file = e.dataTransfer?.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                const fileName = file.name.replace(/\.(pdb|cif|mmcif)$/i, '');
                this.loadProteinFromContent(content, fileName);
            };
            reader.readAsText(file);
        });
    }

    private async fetchProteinFromRCSB(pdbId: string): Promise<void> {
        const cifUrl = `https://files.rcsb.org/download/${pdbId}.cif`;
        console.log(`Attempting to fetch mmCIF: ${cifUrl}`);

        try {
            const cifResponse = await fetch(cifUrl);
            if (cifResponse.ok) {
                const cifContent = await cifResponse.text();
                console.log('Successfully fetched mmCIF format');
                await this.loadProteinFromContent(cifContent, pdbId.toUpperCase(), 'cif');
                this.pdbSearchInput.value = '';
                return;
            }
            console.log('mmCIF not available, trying legacy PDB format...');
        } catch (error) {
            console.warn('mmCIF fetch failed:', error);
        }

        const pdbUrl = `https://files.rcsb.org/download/${pdbId}.pdb`;
        console.log(`Attempting to fetch PDB: ${pdbUrl}`);

        try {
            const pdbResponse = await fetch(pdbUrl);
            if (!pdbResponse.ok) {
                throw new Error('Structure not found in either format');
            }
            const pdbContent = await pdbResponse.text();
            console.log('Successfully fetched legacy PDB format');
            await this.loadProteinFromContent(pdbContent, pdbId.toUpperCase(), 'pdb');
            this.pdbSearchInput.value = '';
        } catch (error) {
            console.error('Error fetching from RCSB:', error);
            alert(`Failed to fetch structure ${pdbId.toUpperCase()}.\n\nThe structure may not exist or there may be a network issue.`);
        }
    }

    public async loadProteinFromContent(content: string, proteinName: string, format?: 'pdb' | 'cif'): Promise<void> {
        this.statusIndicator.classList.add('computing');
        this.statusText.textContent = 'Loading structure...';

        try {
            if (!format) {
                format = content.includes('data_') || content.includes('loop_') ? 'cif' : 'pdb';
                console.log(`Auto-detected format: ${format}`);
            }

            let protein: Protein;
            if (format === 'cif') {
                console.log('Parsing mmCIF format...');
                this.statusText.textContent = 'Parsing mmCIF file...';
                const parser = new CIFParser();
                protein = await new Promise<Protein>((resolve) => {
                    setTimeout(() => {
                        const result = parser.parse(content);
                        console.log('Parsed protein:', result);
                        console.log('Atoms:', result.atoms.length);
                        console.log('Bonds:', result.bonds.length);
                        console.log('Chains:', result.numChains);
                        resolve(result);
                    }, 0);
                });
            } else {
                this.statusText.textContent = 'Parsing PDB file...';
                const parser = new PDBParser();
                protein = await new Promise<Protein>((resolve) => {
                    setTimeout(() => {
                        const result = parser.parse(content);
                        resolve(result);
                    }, 0);
                });
            }

            if (protein.atoms.length > 100000) {
                const proceed = confirm(
                    `WARNING: This structure is VERY large (${protein.atoms.length.toLocaleString()} atoms).\n\n` +
                    `Rendering may be slow or crash your browser.\n\n` +
                    `Recommendations:\n` +
                    `- Only Cartoon mode is safe for this size\n` +
                    `- Ball & Stick/Space Fill WILL freeze your browser\n\n` +
                    `Continue loading?`
                );
                if (!proceed) {
                    this.statusIndicator.classList.remove('computing');
                    this.statusText.textContent = 'Loading cancelled';
                    return;
                }
                this.renderSelect.value = RenderMode.Cartoon;
            } else if (protein.atoms.length > 50000) {
                this.statusText.textContent = `Large structure (${protein.atoms.length.toLocaleString()} atoms) - using Cartoon mode`;
                console.warn(`Large structure: ${protein.atoms.length.toLocaleString()} atoms. Cartoon mode recommended.`);
            }

            const renderMode = this.renderSelect.value as RenderMode;

            this.statusText.textContent = `Rendering ${protein.atoms.length.toLocaleString()} atoms...`;
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    this.proteinRenderer.loadProtein(protein, renderMode);
                    this.proteinRenderer.centerCamera(this.camera, this.controls);
                    resolve();
                }, 50);
            });

            this.updateStatusBar(protein, proteinName);

            if (this.colorUIController) {
                this.colorUIController.onProteinLoaded();
            }

            if (this.autoQualityCheckbox.checked) {
                const currentMode = this.renderSelect.value as RenderMode;

                if (protein.atoms.length > 50000) {
                    if (currentMode !== RenderMode.Cartoon) {
                        this.renderSelect.value = RenderMode.Cartoon;
                        this.proteinRenderer.updateRenderMode(RenderMode.Cartoon);
                        this.updateRenderModeStatus(RenderMode.Cartoon);
                        this.statusText.textContent = `Auto-switched to Cartoon (${protein.atoms.length.toLocaleString()} atoms - very large structure)`;
                        console.warn(`Large structure detected (${protein.atoms.length.toLocaleString()} atoms). Forced Cartoon mode.`);
                    }
                }
                else if (protein.atoms.length > 10000) {
                    if (currentMode === RenderMode.BallAndStick || currentMode === RenderMode.SpaceFill) {
                        this.renderSelect.value = RenderMode.Wireframe;
                        this.proteinRenderer.updateRenderMode(RenderMode.Wireframe);
                        this.updateRenderModeStatus(RenderMode.Wireframe);
                        this.statusText.textContent = `Auto-switched to Wireframe (${protein.atoms.length.toLocaleString()} atoms)`;
                    }
                }
                else if (protein.atoms.length > 5000) {
                    if (currentMode === RenderMode.SpaceFill) {
                        this.renderSelect.value = RenderMode.BallAndStick;
                        this.proteinRenderer.updateRenderMode(RenderMode.BallAndStick);
                        this.updateRenderModeStatus(RenderMode.BallAndStick);
                        this.statusText.textContent = `Auto-switched to Ball & Stick (${protein.atoms.length.toLocaleString()} atoms)`;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading protein:', error);
            this.statusIndicator.classList.remove('computing');
            this.statusText.textContent = 'Error loading structure';
            alert('Error loading protein. Please check the PDB file format.');
        } finally {
            this.statusIndicator.classList.remove('computing');
            if (this.statusText.textContent === 'Loading structure...') {
                this.statusText.textContent = 'Ready';
            }
        }
    }

    private updateStatusBar(protein: Protein, proteinName: string): void {
        this.atomCountDisplay.textContent = protein.atoms.length.toString();
        this.bondCountDisplay.textContent = protein.bonds.length.toString();

        if (protein.name) {
            this.proteinNameDisplay.textContent = `${proteinName} - ${protein.name}`;
        } else {
            this.proteinNameDisplay.textContent = proteinName;
        }

        this.chainCountDisplay.textContent = protein.numChains.toString();

        const uniqueResidues = new Set(protein.atoms.map(atom => `${atom.chainID}-${atom.residueNumber}`));
        this.residueCountDisplay.textContent = uniqueResidues.size.toString();
    }

    public exportImage(): void {
        if (!this.proteinRenderer.hasProtein()) {
            alert('Please load a protein first');
            return;
        }

        this.renderer.render(this.scene, this.camera);

        const dataURL = this.renderer.domElement.toDataURL('image/png');

        const link = document.createElement('a');
        link.download = `${this.proteinNameDisplay.textContent || 'protein'}.png`;
        link.href = dataURL;
        link.click();
    }

    private onRenderModeChange(newMode: RenderMode): void {
        this.proteinRenderer.updateRenderMode(newMode);

        this.updateRenderModeStatus(newMode);
    }

    private updateRenderModeStatus(mode: RenderMode): void {
        const modeNames: Record<RenderMode, string> = {
            [RenderMode.BallAndStick]: 'Ball and Stick',
            [RenderMode.Wireframe]: 'Wireframe',
            [RenderMode.SpaceFill]: 'Space Fill',
            [RenderMode.Cartoon]: 'Cartoon'
        };
        this.renderModeStatus.textContent = `Render: ${modeNames[mode]}`;
    }

    private onQualityPresetChange(): void {
        const preset = this.qualityPresetSelect.value;
        let detail = 16;
        let qualityName = 'Medium';

        switch (preset) {
            case 'ultra-low':
                detail = 4;
                qualityName = 'Ultra Low';
                break;
            case 'low':
                detail = 8;
                qualityName = 'Low';
                break;
            case 'medium':
                detail = 16;
                qualityName = 'Medium';
                break;
            case 'high':
                detail = 32;
                qualityName = 'High';
                break;
        }

        this.qualityStatus.textContent = `Quality: ${qualityName}`;

        this.proteinRenderer.setSphereDetail(detail);

        if (this.proteinRenderer.hasProtein()) {
            const currentMode = this.renderSelect.value as RenderMode;
            this.proteinRenderer.updateRenderMode(currentMode);
        }
    }

    public updateFPS(fps: number): void {
        this.fpsDisplay.textContent = fps.toString();
    }

};