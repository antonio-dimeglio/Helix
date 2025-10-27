import { PerspectiveCamera, WebGLRenderer, Scene } from "three";
import { ProteinRenderer, RenderMode } from "../Renderer/ProteinRenderer";
import { ColorMode, ColorModeCompatibility } from "../Renderer/AtomRenderer";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { PDBParser } from "../PDBParser/PDBParser";
import { Protein } from "../PDBParser/Protein";

const colorModeLabels: Record<string, string> = {
    'element': 'By Element',
    'chain': 'By Chain',
    'residue': 'By Residue',
    'secondary': 'By Secondary Structure',
    'rainbow': 'Rainbow',
    'hydrophobicity': 'By Hydrophobicity'
}



export class UIController {
    private proteinRenderer: ProteinRenderer;
    private renderer: WebGLRenderer;
    private scene: Scene;
    private camera: PerspectiveCamera;
    private controls: OrbitControls;

    // Status display elements
    private fpsDisplay!: HTMLElement;
    private atomCountDisplay!: HTMLElement;
    private bondCountDisplay!: HTMLElement;
    private chainCountDisplay!: HTMLElement;
    private residueCountDisplay!: HTMLElement;
    private proteinNameDisplay!: HTMLElement;
    private qualityIndicator!: HTMLElement;
    private loadingIndicator!: HTMLElement;
    private performanceWarning!: HTMLElement;

    // Control elements
    private colorSchemeSelect!: HTMLSelectElement;
    private renderSelect!: HTMLSelectElement;
    private sampleProteinSelect!: HTMLSelectElement;
    private pdbFileInput!: HTMLInputElement;
    private pdbSearchInput!: HTMLInputElement;
    private fetchBtn!: HTMLButtonElement;
    private resetCameraBtn!: HTMLButtonElement;
    private hamburgerBtn!: HTMLButtonElement;
    private loadProteinBtn!: HTMLButtonElement;
    private exportBtn!: HTMLButtonElement;
    private helpBtn!: HTMLButtonElement;
    private sidebarPanel!: HTMLDivElement;
    private helpModal!: HTMLDivElement;
    private closeHelpBtn!: HTMLButtonElement;
    private qualityPresetSelect!: HTMLSelectElement;
    private sphereDetailSelect!: HTMLSelectElement;
    private autoQualityCheckbox!: HTMLInputElement;

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

        this.initializeElements();
        this.attachEventListeners();
    }

    private initializeElements() {
        // Status display elements
        this.fpsDisplay = document.getElementById('fps')!;
        this.atomCountDisplay = document.getElementById('atomCount')!;
        this.bondCountDisplay = document.getElementById('bondCount')!;
        this.chainCountDisplay = document.getElementById('chainCount')!;
        this.residueCountDisplay = document.getElementById('residueCount')!;
        this.proteinNameDisplay = document.getElementById('proteinName')!;
        this.qualityIndicator = document.getElementById('qualityIndicator')!;
        this.loadingIndicator = document.getElementById('loadingIndicator')!;
        this.performanceWarning = document.getElementById('performanceWarning')!;

        // Control elements
        this.colorSchemeSelect = document.getElementById("colorScheme") as HTMLSelectElement;
        this.renderSelect = document.getElementById("representation") as HTMLSelectElement;
        this.sampleProteinSelect = document.getElementById("sampleProtein") as HTMLSelectElement;
        this.pdbFileInput = document.getElementById("pdbFile") as HTMLInputElement;
        this.pdbSearchInput = document.getElementById("pdbSearch") as HTMLInputElement;
        this.fetchBtn = document.getElementById("fetchBtn") as HTMLButtonElement;
        this.resetCameraBtn = document.getElementById("resetCamera") as HTMLButtonElement;
        this.hamburgerBtn = document.getElementById("hamburgerBtn") as HTMLButtonElement;
        this.loadProteinBtn = document.getElementById("loadProteinBtn") as HTMLButtonElement;
        this.exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
        this.helpBtn = document.getElementById("helpBtn") as HTMLButtonElement;
        this.sidebarPanel = document.getElementById("sidebarPanel") as HTMLDivElement;
        this.helpModal = document.getElementById("helpModal") as HTMLDivElement;
        this.closeHelpBtn = document.getElementById("closeHelpBtn") as HTMLButtonElement;
        this.qualityPresetSelect = document.getElementById("qualityPreset") as HTMLSelectElement;
        this.sphereDetailSelect = document.getElementById("sphereDetail") as HTMLSelectElement;
        this.autoQualityCheckbox = document.getElementById("autoQuality") as HTMLInputElement;
    }

    private attachEventListeners() {
        // Color scheme change
        this.colorSchemeSelect.addEventListener('change', () => {
            const newMode = this.colorSchemeSelect.value as ColorMode;
            this.onColorModeChange(newMode);
        });

        // Render mode change
        this.renderSelect.addEventListener('change', () => {
            const newMode = this.renderSelect.value as RenderMode;
            this.onRenderModeChange(newMode);
        });

        // Sample protein selection
        this.sampleProteinSelect.addEventListener('change', () => {
            const pdbId = this.sampleProteinSelect.value;
            if (!pdbId) return;

            fetch(`/proteins/${pdbId}.pdb`)
                .then(response => {
                    if (!response.ok) throw new Error('Failed to load sample protein');
                    return response.text();
                })
                .then(pdbContent => {
                    this.loadProteinFromContent(pdbContent, pdbId.toUpperCase());
                })
                .catch(error => {
                    console.error('Error loading sample:', error);
                    alert('Failed to load sample protein');
                });
        });

        // File upload
        this.pdbFileInput.addEventListener('change', (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const pdbContent = e.target?.result as string;
                this.loadProteinFromContent(pdbContent, file.name.replace('.pdb', ''));
            };
            reader.readAsText(file);
        });

        // RCSB fetch
        this.fetchBtn.addEventListener('click', () => {
            const pdbId = this.pdbSearchInput.value.trim().toLowerCase();
            if (!pdbId) {
                alert('Please enter a PDB ID');
                return;
            }

            const url = `https://files.rcsb.org/download/${pdbId}.pdb`;

            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error('PDB ID not found');
                    return response.text();
                })
                .then(pdbContent => {
                    this.loadProteinFromContent(pdbContent, pdbId.toUpperCase());
                    this.pdbSearchInput.value = ''; // Clear search box
                })
                .catch(error => {
                    console.error('Error fetching from RCSB:', error);
                    alert(`Failed to fetch PDB ${pdbId.toUpperCase()}. Please check the ID and try again.`);
                });
        });

        // Enter key on search
        this.pdbSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.fetchBtn.click();
            }
        });

        // Reset camera
        this.resetCameraBtn.addEventListener('click', () => {
            this.proteinRenderer.centerCamera(this.camera, this.controls);
        });

        // Hamburger menu
        this.hamburgerBtn.addEventListener('click', () => {
            this.sidebarPanel.classList.toggle('open');
        });

        // Load protein button
        this.loadProteinBtn.addEventListener('click', () => {
            this.sidebarPanel.classList.add('open');
        });

        // Help modal
        this.helpBtn.addEventListener('click', () => {
            this.helpModal.classList.add('active');
        });

        this.closeHelpBtn.addEventListener('click', () => {
            this.helpModal.classList.remove('active');
        });

        this.helpModal.addEventListener('click', (e) => {
            if (e.target === this.helpModal) {
                this.helpModal.classList.remove('active');
            }
        });

        // Export image
        this.exportBtn.addEventListener('click', () => {
            this.exportImage();
        });

        // Quality settings
        this.qualityPresetSelect.addEventListener('change', () => {
            this.onQualityPresetChange();
        });

        this.sphereDetailSelect.addEventListener('change', () => {
            this.onSphereDetailChange();
        });
    }   

    public updateColorDropdown(renderMode: RenderMode): void {
        const validColorModes: ColorMode[] = [];
        for (const colorMode in ColorModeCompatibility) {
            const compatibleRenderMode = ColorModeCompatibility[colorMode as ColorMode];
            if (compatibleRenderMode.includes(renderMode)) {
                validColorModes.push(colorMode as ColorMode);
            }
        }
        const currentSelectedColorMode = this.colorSchemeSelect.value as ColorMode;
        this.colorSchemeSelect.innerHTML = '';

        for (const mode of validColorModes) {
            const option = document.createElement('option');
            option.value = mode;
            option.text = colorModeLabels[mode];
            this.colorSchemeSelect.add(option);
        }

        const isValid = Array.from(this.colorSchemeSelect.options)
            .some(option => option.value === currentSelectedColorMode);

        if (isValid) {
            this.colorSchemeSelect.value = currentSelectedColorMode;
        } else {
            this.colorSchemeSelect.selectedIndex = 0;
        }
    }

    public async loadProteinFromContent(pdbContent: string, proteinName: string): Promise<void> {
        this.loadingIndicator.classList.add('active');
        this.performanceWarning.classList.remove('active');

        try {
            // Parse PDB asynchronously to avoid blocking UI
            const parser = new PDBParser();
            const protein = await new Promise<any>((resolve) => {
                setTimeout(() => {
                    const result = parser.parsePDB(pdbContent);
                    resolve(result);
                }, 0);
            });

            const renderMode = this.renderSelect.value as RenderMode;
            const colorScheme = this.colorSchemeSelect.value as ColorMode;

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    this.proteinRenderer.loadProtein(protein, renderMode, colorScheme);
                    this.proteinRenderer.centerCamera(this.camera, this.controls);
                    resolve();
                }, 0);
            });

            this.updateStatusBar(protein, proteinName);

            // Show performance warning for large proteins
            if (protein.atoms.length > 5000 && this.autoQualityCheckbox.checked) {
                this.performanceWarning.classList.add('active');
                if (renderMode === RenderMode.BallAndStick || renderMode === RenderMode.SpaceFill) {
                    this.renderSelect.value = RenderMode.Wireframe;
                    this.proteinRenderer.updateRenderMode(RenderMode.Wireframe);
                }
            }
        } catch (error) {
            console.error('Error loading protein:', error);
            alert('Error loading protein. Please check the PDB file format.');
        } finally {
            this.loadingIndicator.classList.remove('active');
        }
    }

    /**
     * Update status bar with protein statistics
     */
    private updateStatusBar(protein: Protein, proteinName: string): void {
        this.atomCountDisplay.textContent = protein.atoms.length.toString();
        this.bondCountDisplay.textContent = protein.bonds.length.toString();
        this.proteinNameDisplay.textContent = `${proteinName} - ${protein.name}`;

        // Count unique chains and residues
        this.chainCountDisplay.textContent = protein.numChains.toString();

        const uniqueResidues = new Set(protein.atoms.map(atom => `${atom.chainID}-${atom.residueNumber}`));
        this.residueCountDisplay.textContent = uniqueResidues.size.toString();
    }

    /**
     * Export current view as PNG image
     */
    public exportImage(): void {
        if (!this.proteinRenderer.protein) {
            alert('Please load a protein first');
            return;
        }

        // Render the scene one more time to ensure it's up to date
        this.renderer.render(this.scene, this.camera);

        // Convert canvas to data URL
        const dataURL = this.renderer.domElement.toDataURL('image/png');

        // Create download link
        const link = document.createElement('a');
        link.download = `${this.proteinNameDisplay.textContent || 'protein'}.png`;
        link.href = dataURL;
        link.click();
    }

    /**
     * Handle render mode change
     */
    private onRenderModeChange(newMode: RenderMode): void {
        // Update color dropdown based on new render mode
        this.updateColorDropdown(newMode);

        // Update renderer
        this.proteinRenderer.updateRenderMode(newMode);
    }

    /**
     * Handle color mode change
     */
    private onColorModeChange(newMode: ColorMode): void {
        this.proteinRenderer.updateColorMode(newMode);
    }

    /**
     * Handle quality preset change
     */
    private onQualityPresetChange(): void {
        const preset = this.qualityPresetSelect.value;
        let detail = 16;
        switch (preset) {
            case 'low':
                detail = 8;
                this.sphereDetailSelect.value = '8';
                this.qualityIndicator.textContent = 'Low';
                break;
            case 'medium':
                detail = 16;
                this.sphereDetailSelect.value = '16';
                this.qualityIndicator.textContent = 'Medium';
                break;
            case 'high':
                detail = 32;
                this.sphereDetailSelect.value = '32';
                this.qualityIndicator.textContent = 'High';
                break;
        }
        this.proteinRenderer.setSphereDetail(detail);
    }

    /**
     * Handle sphere detail change
     */
    private onSphereDetailChange(): void {
        const detail = parseInt(this.sphereDetailSelect.value);
        if (detail <= 8) {
            this.qualityIndicator.textContent = 'Low';
        } else if (detail <= 16) {
            this.qualityIndicator.textContent = 'Medium';
        } else {
            this.qualityIndicator.textContent = 'High';
        }
        this.proteinRenderer.setSphereDetail(detail);
    }

    /**
     * Update FPS display (called from animation loop)
     */
    public updateFPS(fps: number): void {
        this.fpsDisplay.textContent = fps.toString();
    }

};