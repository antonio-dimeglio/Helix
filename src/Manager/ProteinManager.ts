import { Protein } from "../Shared/Protein";

export interface LoadedProtein {
    id: string;
    protein: Protein;
    name: string;
    visible: boolean;
    originalFileContent?: string;  // Store original file for docking
    originalFileFormat?: string;   // 'pdb', 'cif', 'sdf', 'mol2', etc.
    moleculeType: string;          // 'protein', 'small_molecule', 'complex', 'peptide'
}

export class ProteinManager {
    private proteins: Map<string, LoadedProtein>;
    private nextId: number;

    constructor() {
        this.proteins = new Map();
        this.nextId = 1;
    }

    addProtein(protein: Protein, name: string, fileContent?: string, fileFormat?: string, moleculeType?: string): string {
        const id = `protein_${this.nextId++}`;

        // Auto-detect molecule type based on format or default to 'protein'
        let detectedType = moleculeType || 'protein';
        if (!moleculeType && fileFormat) {
            // SDF, MOL, MOL2 are typically small molecules
            if (['sdf', 'mol', 'mol2'].includes(fileFormat.toLowerCase())) {
                detectedType = 'small_molecule';
            }
        }

        const loadedProtein: LoadedProtein = {
            id,
            protein,
            name,
            visible: true,
            originalFileContent: fileContent,
            originalFileFormat: fileFormat,
            moleculeType: detectedType
        };
        this.proteins.set(id, loadedProtein);
        return id;
    }

    removeProtein(id: string): boolean {
        return this.proteins.delete(id);
    }

    getProtein(id: string): LoadedProtein | undefined {
        return this.proteins.get(id);
    }

    getAllProteins(): LoadedProtein[] {
        return Array.from(this.proteins.values());
    }

    getVisibleProteins(): LoadedProtein[] {
        return Array.from(this.proteins.values()).filter(p => p.visible);
    }

    setProteinVisibility(id: string, visible: boolean): boolean {
        const protein = this.proteins.get(id);
        if (protein) {
            protein.visible = visible;
            return true;
        }
        return false;
    }

    toggleProteinVisibility(id: string): boolean {
        const protein = this.proteins.get(id);
        if (protein) {
            protein.visible = !protein.visible;
            return protein.visible;
        }
        return false;
    }

    clear(): void {
        this.proteins.clear();
    }

    getProteinCount(): number {
        return this.proteins.size;
    }
}
