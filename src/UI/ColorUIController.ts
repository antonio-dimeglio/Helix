import { ProteinRenderer } from "../Renderer/ProteinRenderer";
import { ColorScheme } from "../Renderer/Color/ColorScheme";
import { generateParameters } from "./ParameterGenerator";
import { RenderMode } from "../Renderer/RenderMode";

export class ColorUIController {
    private proteinRenderer: ProteinRenderer;
    private currentScheme: ColorScheme | null;
    private parameterContent: HTMLElement;
    private schemeOptions: NodeListOf<Element>;
    private statusText: HTMLElement;
    private statusIndicator: HTMLElement;

    constructor(proteinRenderer: ProteinRenderer) {
        this.proteinRenderer = proteinRenderer;
        this.currentScheme = null;

        this.parameterContent = null!;
        this.schemeOptions = null!;
        this.statusText = null!;
        this.statusIndicator = null!;

        this.initializeElements();
        this.attachEventListeners();
        this.setInitialScheme();
    }

    private initializeElements(): void {
        this.parameterContent = document.getElementById('parameter-content')!;
        this.schemeOptions = document.querySelectorAll('.scheme-option');
        this.statusText = document.getElementById('statusText')!;
        this.statusIndicator = document.getElementById('statusIndicator')!;
    }

    private attachEventListeners(): void {
        // Attach click listeners to all scheme options
        this.schemeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const schemeId = option.getAttribute('data-scheme');
                if (schemeId) {
                    this.onSchemeSelected(schemeId);
                }
            });
        });
    }

    private setInitialScheme(): void {
        // Set "element" scheme as active by default
        const elementScheme = this.proteinRenderer.getColorSchemeRegistry().get('element');
        if (elementScheme) {
            this.onSchemeSelected('element');
        }
    }

    private onSchemeSelected(schemeId: string): void {
        // Get scheme from registry
        const scheme = this.proteinRenderer.getColorSchemeRegistry().get(schemeId);
        if (!scheme) {
            console.error(`Scheme '${schemeId}' not found in registry`);
            return;
        }

        // Update active state in UI
        this.schemeOptions.forEach(option => {
            if (option.getAttribute('data-scheme') === schemeId) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });

        // Store current scheme
        this.currentScheme = scheme;

        // Display parameters
        this.displayParameters(scheme);

        // Apply scheme to protein if loaded
        if (this.proteinRenderer.hasProtein()) {
            this.applyScheme(scheme);
        }
    }

    private displayParameters(scheme: ColorScheme): void {
        // Clear parameter panel
        this.parameterContent.innerHTML = '';

        // Add real-time/compute indicator
        const updateMode = document.createElement('div');
        updateMode.className = scheme.isRealtime() ? 'update-mode' : 'update-mode manual';

        const indicator = document.createElement('div');
        indicator.className = 'update-mode-indicator';
        updateMode.appendChild(indicator);

        const label = document.createElement('span');
        label.className = 'update-mode-label';
        label.textContent = scheme.isRealtime() ? 'Real-time updates enabled' : 'Manual computation required';
        updateMode.appendChild(label);

        this.parameterContent.appendChild(updateMode);

        // Add info box
        const infoBox = document.createElement('div');
        infoBox.className = 'info-box';

        const infoTitle = document.createElement('div');
        infoTitle.className = 'info-box-title';
        infoTitle.textContent = scheme.label;
        infoBox.appendChild(infoTitle);

        const infoText = document.createTextNode(scheme.description);
        infoBox.appendChild(infoText);

        this.parameterContent.appendChild(infoBox);

        // Generate parameter controls
        const params = scheme.getParameters();
        if (params.length > 0) {
            const paramElements = generateParameters(params);
            paramElements.forEach(elem => this.parameterContent.appendChild(elem));

            // Attach change listeners to all parameter controls
            this.parameterContent.querySelectorAll('[data-param]').forEach(control => {
                control.addEventListener('change', (e) => {
                    this.onParameterChange(scheme, e.target as HTMLElement);
                });

                // For range and color inputs, also listen to 'input' event for live updates
                const inputType = (control as HTMLInputElement).type;
                if (inputType === 'range' || inputType === 'color') {
                    control.addEventListener('input', (e) => {
                        this.onParameterChange(scheme, e.target as HTMLElement);
                    });
                }
            });
        }

        // Add compute button for non-realtime schemes
        if (!scheme.isRealtime()) {
            const actionBar = document.createElement('div');
            actionBar.className = 'action-bar';

            const computeBtn = document.createElement('button');
            computeBtn.className = 'btn btn-primary';
            computeBtn.textContent = 'Compute & Apply';
            computeBtn.addEventListener('click', () => {
                this.applyScheme(scheme);
            });

            actionBar.appendChild(computeBtn);
            this.parameterContent.appendChild(actionBar);
        }
    }

    private onParameterChange(scheme: ColorScheme, control: HTMLElement): void {
        const paramName = control.getAttribute('data-param');
        if (!paramName) return;

        // Read value based on control type
        let value: any;
        const input = control as HTMLInputElement;

        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'range') {
            value = parseFloat(input.value);
        } else if (input.type === 'number') {
            value = parseFloat(input.value);
        } else {
            value = input.value; // select, color, text
        }

        // Update the scheme parameter
        scheme.setParameter(paramName, value);

        // If real-time and protein is loaded, apply immediately
        if (scheme.isRealtime() && this.proteinRenderer.hasProtein()) {
            this.applyScheme(scheme);
        }
    }

    private async applyScheme(scheme: ColorScheme): Promise<void> {
        if (!this.proteinRenderer.hasProtein()) {
            return;
        }

        // Check if scheme requires precomputation
        if (scheme.requiresPrecomputation()) {
            // Show computing state
            this.statusIndicator.classList.add('computing');
            this.statusText.textContent = 'Computing color scheme...';

            try {
                const protein = this.proteinRenderer.getColorContext();
                if (protein) {
                    await scheme.precompute(protein.protein);
                }
            } catch (error) {
                console.error('Error during color scheme precomputation:', error);
                this.statusText.textContent = 'Error computing colors';
                this.statusIndicator.classList.remove('computing');
                return;
            }

            // Remove computing state
            this.statusIndicator.classList.remove('computing');
            this.statusText.textContent = 'Ready';
        }

        // Apply colors to protein
        this.proteinRenderer.recolorProtein(scheme);
    }

    /**
     * Called when a new protein is loaded
     */
    public onProteinLoaded(): void {
        // If a scheme is selected, apply it to the new protein
        if (this.currentScheme) {
            this.applyScheme(this.currentScheme);
        }
    }
}
