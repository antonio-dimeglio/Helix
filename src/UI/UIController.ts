import { PerspectiveCamera, WebGLRenderer, Scene } from "three";
import { ProteinRenderer, RenderMode } from "../Renderer/ProteinRenderer";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { PDBParser } from "../Parser/PDBParser/PDBParser";
import { CIFParser } from "../Parser/CIFParser/CIFParser";
import { SDFParser } from "../Parser/SDFParser/SDFParser";
import { MOL2Parser } from "../Parser/MOL2Parser/MOL2Parser";
import { Protein } from "../Shared/Protein";
import { ColorUIController } from "./ColorUIController";
import { ProteinManager } from "../Manager/ProteinManager";

export class UIController {
    private proteinRenderer: ProteinRenderer;
    private renderer: WebGLRenderer;
    private scene: Scene;
    private camera: PerspectiveCamera;
    private controls: OrbitControls;
    private colorUIController: ColorUIController | null;
    private proteinManager: ProteinManager;
    private selectedProteinId: string | null;

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
    private sourceSelect!: HTMLSelectElement;
    private fetchInput!: HTMLInputElement;
    private fetchInputLabel!: HTMLElement;
    private fetchHint!: HTMLElement;
    private fetchBtn!: HTMLButtonElement;
    private resetCameraBtn!: HTMLButtonElement;
    private exportBtn!: HTMLButtonElement;
    private qualityPresetSelect!: HTMLSelectElement;
    private autoQualityCheckbox!: HTMLInputElement;
    private frustumCullingCheckbox!: HTMLInputElement;
    private showDisulfideBondsCheckbox!: HTMLInputElement;
    private showWaterCheckbox!: HTMLInputElement;
    private proteinListContainer!: HTMLDivElement;
    private simulateDockingBtn!: HTMLButtonElement;
    private dockingModal!: HTMLDivElement;
    private modalCloseBtn!: HTMLButtonElement;
    private receptorSelect!: HTMLSelectElement;
    private ligandSelect!: HTMLSelectElement;
    private runDockingBtn!: HTMLButtonElement;
    private cancelDockingBtn!: HTMLButtonElement;

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
        this.proteinManager = new ProteinManager();
        this.selectedProteinId = null;

        this.initializeElements();
        this.attachEventListeners();

        // Initialize UI labels for the default source
        this.updateFetchUIForSource();
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
        this.sourceSelect = document.getElementById("sourceSelect") as HTMLSelectElement;
        this.fetchInput = document.getElementById("fetchInput") as HTMLInputElement;
        this.fetchInputLabel = document.getElementById("fetchInputLabel") as HTMLElement;
        this.fetchHint = document.getElementById("fetchHint") as HTMLElement;
        this.fetchBtn = document.getElementById("fetchBtn") as HTMLButtonElement;
        this.resetCameraBtn = document.getElementById("resetCameraBtn") as HTMLButtonElement;
        this.exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
        this.qualityPresetSelect = document.getElementById("qualityPresetSelect") as HTMLSelectElement;
        this.autoQualityCheckbox = document.getElementById("autoQualityCheckbox") as HTMLInputElement;
        this.frustumCullingCheckbox = document.getElementById("frustumCullingCheckbox") as HTMLInputElement;
        this.showDisulfideBondsCheckbox = document.getElementById("showDisulfideBondsCheckbox") as HTMLInputElement;
        this.showWaterCheckbox = document.getElementById("showWaterCheckbox") as HTMLInputElement;
        this.proteinListContainer = document.getElementById("proteinListContainer") as HTMLDivElement;
        this.simulateDockingBtn = document.getElementById("simulateDockingBtn") as HTMLButtonElement;
        this.dockingModal = document.getElementById("dockingModal") as HTMLDivElement;
        this.modalCloseBtn = document.getElementById("modalCloseBtn") as HTMLButtonElement;
        this.receptorSelect = document.getElementById("receptorSelect") as HTMLSelectElement;
        this.ligandSelect = document.getElementById("ligandSelect") as HTMLSelectElement;
        this.runDockingBtn = document.getElementById("runDockingBtn") as HTMLButtonElement;
        this.cancelDockingBtn = document.getElementById("cancelDockingBtn") as HTMLButtonElement;
    }

    private attachEventListeners() {
        // Source selector change - update UI hints
        this.sourceSelect.addEventListener('change', () => {
            this.updateFetchUIForSource();
        });

        this.fetchBtn.addEventListener('click', async () => {
            const source = this.sourceSelect.value;
            const query = this.fetchInput.value.trim();

            if (!query) {
                alert('Please enter an ID or name');
                return;
            }

            switch (source) {
                case 'pdb':
                    await this.fetchProteinFromRCSB(query.toLowerCase());
                    break;
                case 'pubchem':
                    await this.fetchFromPubChem(query);
                    break;
                case 'chembl':
                    await this.fetchFromChEMBL(query);
                    break;
            }
        });

        // Enter key support
        this.fetchInput.addEventListener('keypress', (e) => {
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

        this.simulateDockingBtn.addEventListener('click', () => {
            this.openDockingModal();
        });

        this.modalCloseBtn.addEventListener('click', () => {
            this.closeDockingModal();
        });

        this.cancelDockingBtn.addEventListener('click', () => {
            this.closeDockingModal();
        });

        this.dockingModal.addEventListener('click', (e) => {
            if (e.target === this.dockingModal) {
                this.closeDockingModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.dockingModal.style.display === 'flex') {
                this.closeDockingModal();
            }
        });

        this.receptorSelect.addEventListener('change', () => {
            this.updateRunButtonState();
        });

        this.ligandSelect.addEventListener('change', () => {
            this.updateRunButtonState();
        });

        this.runDockingBtn.addEventListener('click', () => {
            this.runDocking();
        });

        this.uploadArea.addEventListener('click', () => {
            this.pdbFileInput.click();
        });

        this.pdbFileInput.addEventListener('change', async (event) => {
            const files = (event.target as HTMLInputElement).files;
            if (!files || files.length === 0) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                await new Promise<void>((resolve) => {
                    reader.onload = async (e) => {
                        const content = e.target?.result as string;
                        const fileName = file.name.replace(/\.(pdb|cif|mmcif)$/i, '');
                        await this.loadProteinFromContent(content, fileName);
                        resolve();
                    };
                    reader.readAsText(file);
                });
            }

            (event.target as HTMLInputElement).value = '';
        });

        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = 'var(--accent-primary)';
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.style.borderColor = '';
        });

        this.uploadArea.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = '';

            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                await new Promise<void>((resolve) => {
                    reader.onload = async (e) => {
                        const content = e.target?.result as string;
                        const fileName = file.name.replace(/\.(pdb|cif|mmcif)$/i, '');
                        await this.loadProteinFromContent(content, fileName);
                        resolve();
                    };
                    reader.readAsText(file);
                });
            }
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
                this.fetchInput.value = '';
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
            this.fetchInput.value = '';
        } catch (error) {
            console.error('Error fetching from RCSB:', error);
            alert(`Failed to fetch structure ${pdbId.toUpperCase()}.\n\nThe structure may not exist or there may be a network issue.`);
        }
    }

    public async loadProteinFromContent(content: string, proteinName: string, format?: 'pdb' | 'cif' | 'sdf' | 'mol' | 'mol2'): Promise<void> {
        this.statusIndicator.classList.add('computing');
        this.statusText.textContent = 'Loading structure...';

        try {
            if (!format) {
                // Auto-detect format
                if (content.includes('data_') || content.includes('loop_')) {
                    format = 'cif';
                } else if (content.includes('$$$$') || content.includes('M  END')) {
                    format = 'sdf';
                } else if (content.includes('@<TRIPOS>MOLECULE')) {
                    format = 'mol2';
                } else {
                    format = 'pdb';
                }
                console.log(`Auto-detected format: ${format}`);
            }

            let protein: Protein;
            let moleculeType: string = 'protein';

            if (format === 'sdf' || format === 'mol') {
                console.log('Parsing SDF/MOL format...');
                this.statusText.textContent = 'Parsing small molecule...';
                const parser = new SDFParser();
                protein = await new Promise<Protein>((resolve) => {
                    setTimeout(() => {
                        const result = parser.parse(content, proteinName);
                        console.log('Parsed molecule:', result);
                        console.log('Atoms:', result.atoms.length);
                        console.log('Bonds:', result.bonds.length);
                        resolve(result);
                    }, 0);
                });
                moleculeType = 'small_molecule';
            } else if (format === 'mol2') {
                console.log('Parsing MOL2 format...');
                this.statusText.textContent = 'Parsing small molecule...';
                const parser = new MOL2Parser();
                protein = await new Promise<Protein>((resolve) => {
                    setTimeout(() => {
                        const result = parser.parse(content, proteinName);
                        console.log('Parsed molecule:', result);
                        console.log('Atoms:', result.atoms.length);
                        console.log('Bonds:', result.bonds.length);
                        resolve(result);
                    }, 0);
                });
                moleculeType = 'small_molecule';
            } else if (format === 'cif') {
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
            const proteinId = this.proteinManager.addProtein(protein, proteinName, content, format, moleculeType);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    this.proteinRenderer.addProteinToScene(proteinId, protein, renderMode);
                    resolve();
                }, 50);
            });

            this.updateProteinList();

            // Auto-select the newly loaded protein and focus on it
            this.selectedProteinId = proteinId;
            this.proteinRenderer.focusOnProtein(proteinId, this.camera, this.controls);
            this.updateProteinList(); // Update again to show selection

            console.log(`Added protein: ${proteinName} (${proteinId})`);

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

    private updateProteinList(): void {
        const proteins = this.proteinManager.getAllProteins();

        this.simulateDockingBtn.disabled = proteins.length < 2;

        if (proteins.length === 0) {
            this.proteinListContainer.innerHTML = `
                <div class="info-box">
                    <div class="info-box-title">No Proteins Loaded</div>
                    Load a protein to get started
                </div>
            `;
            return;
        }

        this.proteinListContainer.innerHTML = proteins.map(p => `
            <div class="protein-item ${p.id === this.selectedProteinId ? 'selected' : ''}" data-protein-id="${p.id}">
                <div class="protein-visibility" data-protein-id="${p.id}" title="${p.visible ? 'Hide' : 'Show'}">
                    ${p.visible ? '👁' : '👁‍🗨'}
                </div>
                <div class="protein-info">
                    <div class="protein-name" title="${p.name}">${p.name}</div>
                    <div class="protein-stats">${p.protein.atoms.length.toLocaleString()} atoms</div>
                </div>
                <div class="protein-delete" data-protein-id="${p.id}" title="Remove protein">×</div>
            </div>
        `).join('');

        proteins.forEach(p => {
            const proteinItem = this.proteinListContainer.querySelector(
                `.protein-item[data-protein-id="${p.id}"]`
            ) as HTMLElement;
            const visibilityBtn = this.proteinListContainer.querySelector(
                `.protein-visibility[data-protein-id="${p.id}"]`
            ) as HTMLElement;
            const deleteBtn = this.proteinListContainer.querySelector(
                `.protein-delete[data-protein-id="${p.id}"]`
            ) as HTMLElement;

            if (proteinItem) {
                proteinItem.addEventListener('click', () => {
                    this.selectProtein(p.id);
                });
            }

            if (visibilityBtn) {
                visibilityBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleProteinVisibility(p.id);
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteProtein(p.id);
                });
            }
        });
    }

    private selectProtein(proteinId: string): void {
        // If clicking the same protein, deselect it
        if (this.selectedProteinId === proteinId) {
            this.deselectProtein();
            return;
        }

        this.selectedProteinId = proteinId;
        this.updateProteinList();

        const protein = this.proteinManager.getProtein(proteinId);
        if (protein) {
            // Focus camera on the selected protein
            this.proteinRenderer.focusOnProtein(proteinId, this.camera, this.controls);

            if (this.colorUIController) {
                this.colorUIController.setCurrentProtein(proteinId);
            }
            this.updateStatusBar(protein.protein, protein.name);
        }

        console.log(`Selected protein: ${proteinId}`);
    }

    private deselectProtein(): void {
        this.selectedProteinId = null;
        this.updateProteinList();

        // Reset camera to show all proteins
        this.proteinRenderer.centerCamera(this.camera, this.controls);

        this.statusText.textContent = 'Ready';
        console.log('Deselected protein - showing all proteins');
    }

    private toggleProteinVisibility(proteinId: string): void {
        const newVisibility = this.proteinManager.toggleProteinVisibility(proteinId);
        this.proteinRenderer.setProteinVisibility(proteinId, newVisibility);
        this.updateProteinList();
        console.log(`Protein ${proteinId} visibility: ${newVisibility}`);
    }

    private deleteProtein(proteinId: string): void {
        this.proteinRenderer.removeProteinFromScene(proteinId);
        this.proteinManager.removeProtein(proteinId);
        this.updateProteinList();
        console.log(`Deleted protein ${proteinId} from scene and memory`);
    }

    public getProteinManager(): ProteinManager {
        return this.proteinManager;
    }

    private openDockingModal(): void {
        const proteins = this.proteinManager.getAllProteins();

        this.receptorSelect.innerHTML = '<option value="">Select receptor protein...</option>';
        this.ligandSelect.innerHTML = '<option value="">Select ligand protein...</option>';

        proteins.forEach(p => {
            const receptorOption = document.createElement('option');
            receptorOption.value = p.id;
            receptorOption.textContent = `${p.name} (${p.protein.atoms.length.toLocaleString()} atoms)`;
            this.receptorSelect.appendChild(receptorOption);

            const ligandOption = document.createElement('option');
            ligandOption.value = p.id;
            ligandOption.textContent = `${p.name} (${p.protein.atoms.length.toLocaleString()} atoms)`;
            this.ligandSelect.appendChild(ligandOption);
        });

        this.receptorSelect.value = '';
        this.ligandSelect.value = '';
        this.runDockingBtn.disabled = true;

        this.dockingModal.style.display = 'flex';
    }

    private closeDockingModal(): void {
        this.dockingModal.classList.add('closing');
        setTimeout(() => {
            this.dockingModal.style.display = 'none';
            this.dockingModal.classList.remove('closing');
        }, 200);
    }

    private updateRunButtonState(): void {
        const receptorId = this.receptorSelect.value;
        const ligandId = this.ligandSelect.value;

        this.runDockingBtn.disabled = !receptorId || !ligandId || receptorId === ligandId;
    }

    private async runDocking(): Promise<void> {
        const receptorId = this.receptorSelect.value;
        const ligandId = this.ligandSelect.value;

        if (!receptorId || !ligandId || receptorId === ligandId) {
            alert('Please select two different proteins');
            return;
        }

        const receptor = this.proteinManager.getProtein(receptorId);
        const ligand = this.proteinManager.getProtein(ligandId);

        if (!receptor || !ligand) {
            alert('Error: Could not find selected proteins');
            return;
        }

        console.log('Running docking simulation...');
        console.log('Receptor:', receptor.name, receptor.id);
        console.log('Ligand:', ligand.name, ligand.id);

        this.closeDockingModal();

        // Show computing status
        this.statusIndicator.classList.add('computing');
        this.statusText.textContent = 'Sending docking request...';

        try {
            await this.sendDockingRequest(receptor.protein, ligand.protein, receptor.name, ligand.name);
        } catch (error) {
            console.error('Docking request failed:', error);
            this.statusIndicator.classList.remove('computing');
            this.statusText.textContent = 'Docking request failed';
            alert(`Docking simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async sendDockingRequest(
        receptor: Protein,
        ligand: Protein,
        receptorName: string,
        ligandName: string
    ): Promise<void> {
        // Get the loaded protein data to access original file content
        const receptorData = Array.from(this.proteinManager.getAllProteins()).find(
            p => p.protein === receptor
        );
        const ligandData = Array.from(this.proteinManager.getAllProteins()).find(
            p => p.protein === ligand
        );

        const requestData: any = {
            receptor: {
                name: receptorName,
                moleculeType: receptorData?.moleculeType || 'protein',
                atoms: receptor.atoms,
                bonds: receptor.bonds,
            },
            ligand: {
                name: ligandName,
                moleculeType: ligandData?.moleculeType || 'protein',
                atoms: ligand.atoms,
                bonds: ligand.bonds,
            }
        };

        // Add original file content if available (better for docking)
        if (receptorData?.originalFileContent && receptorData?.originalFileFormat) {
            requestData.receptor.fileContent = receptorData.originalFileContent;
            requestData.receptor.fileFormat = receptorData.originalFileFormat;
        }
        if (ligandData?.originalFileContent && ligandData?.originalFileFormat) {
            requestData.ligand.fileContent = ligandData.originalFileContent;
            requestData.ligand.fileFormat = ligandData.originalFileFormat;
        }

        console.log('Sending docking request to http://localhost:3000/dock...');
        console.log('Request data:', {
            receptor: {
                name: receptorName,
                atomCount: receptor.atoms.length,
                bondCount: receptor.bonds.length,
                format: receptorData?.originalFileFormat || 'parsed atoms',
                hasOriginalFile: !!receptorData?.originalFileContent
            },
            ligand: {
                name: ligandName,
                atomCount: ligand.atoms.length,
                bondCount: ligand.bonds.length,
                format: ligandData?.originalFileFormat || 'parsed atoms',
                hasOriginalFile: !!ligandData?.originalFileContent
            }
        });

        const response = await fetch('http://localhost:3000/dock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('Docking simulation result:', result);

        this.statusIndicator.classList.remove('computing');
        this.statusText.textContent = 'Docking completed';

        // Show success message with result
        alert(`Docking simulation completed!\n\nCheck the console for results.`);
    }

    private updateFetchUIForSource(): void {
        const source = this.sourceSelect.value;

        switch (source) {
            case 'pdb':
                this.fetchInputLabel.textContent = 'PDB ID';
                this.fetchInput.placeholder = 'e.g. 1CRN';
                this.fetchHint.textContent = '4-letter PDB code';
                break;
            case 'pubchem':
                this.fetchInputLabel.textContent = 'Compound Name or CID';
                this.fetchInput.placeholder = 'e.g. aspirin, ATP, or 2244';
                this.fetchHint.textContent = 'Name or PubChem CID';
                break;
            case 'chembl':
                this.fetchInputLabel.textContent = 'ChEMBL ID';
                this.fetchInput.placeholder = 'e.g. CHEMBL25';
                this.fetchHint.textContent = 'ChEMBL compound ID';
                break;
        }
    }

    private async fetchFromPubChem(query: string): Promise<void> {
        this.statusIndicator.classList.add('computing');
        this.statusText.textContent = 'Fetching from PubChem...';

        try {
            // PubChem PUG REST API
            // Try to fetch by CID (Compound ID) first if query is numeric
            const isNumeric = /^\d+$/.test(query);
            let sdfContent: string;
            let moleculeName: string;

            if (isNumeric) {
                // Fetch by CID
                const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${query}/SDF`;
                console.log(`Fetching from PubChem by CID: ${url}`);

                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`PubChem API returned ${response.status}: ${response.statusText}`);
                }

                sdfContent = await response.text();
                moleculeName = `CID_${query}`;
            } else {
                // Fetch by name - first need to resolve name to CID
                const nameUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`;
                console.log(`Resolving compound name: ${nameUrl}`);

                const nameResponse = await fetch(nameUrl);
                if (!nameResponse.ok) {
                    throw new Error(`Compound "${query}" not found in PubChem`);
                }

                const nameData = await nameResponse.json();
                const cid = nameData.IdentifierList?.CID?.[0];

                if (!cid) {
                    throw new Error(`No compound found for "${query}"`);
                }

                console.log(`Resolved "${query}" to CID ${cid}`);

                // Now fetch the SDF by CID
                const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF`;
                const sdfResponse = await fetch(sdfUrl);

                if (!sdfResponse.ok) {
                    throw new Error(`Failed to fetch SDF for CID ${cid}`);
                }

                sdfContent = await sdfResponse.text();
                moleculeName = `${query}_CID_${cid}`;
            }

            // Parse and load the SDF
            console.log('PubChem: Successfully fetched SDF');
            await this.loadProteinFromContent(sdfContent, moleculeName, 'sdf');

            this.statusText.textContent = `Loaded ${moleculeName} from PubChem`;
        } catch (error) {
            console.error('Error fetching from PubChem:', error);
            alert(`Failed to fetch from PubChem: ${error instanceof Error ? error.message : error}`);
            this.statusText.textContent = 'Ready';
        } finally {
            this.statusIndicator.classList.remove('computing');
        }
    }

    private async fetchFromChEMBL(query: string): Promise<void> {
        this.statusIndicator.classList.add('computing');
        this.statusText.textContent = 'Fetching from ChEMBL...';

        try {
            // TODO: Implement ChEMBL API integration
            alert('ChEMBL integration coming soon!\n\nFor now, please use file upload for small molecules.');
            console.log('ChEMBL query:', query);
        } catch (error) {
            console.error('Error fetching from ChEMBL:', error);
            alert(`Failed to fetch from ChEMBL: ${error}`);
        } finally {
            this.statusIndicator.classList.remove('computing');
            this.statusText.textContent = 'Ready';
        }
    }

};