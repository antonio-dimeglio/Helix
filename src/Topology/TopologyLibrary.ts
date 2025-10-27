
import topologyData from './topology.json';
import { ResidueTemplate } from './ResidueTemplate';

export class TopologyLibrary {
    private templates: Record<string, ResidueTemplate>;

    constructor() {
        this.templates = topologyData as unknown as Record<string, ResidueTemplate>;
    }

    getTemplate(residueCode: string): ResidueTemplate | undefined {
        return this.templates[residueCode];
    }

    hasTemplate(residueCode: string): boolean {
        return residueCode in this.templates;
    }

};