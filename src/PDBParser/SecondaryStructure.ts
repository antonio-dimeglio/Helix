
export enum StructureType {
    Helix = 'helix',
    Sheet = 'sheet',
    Loop = 'loop'
};

export class SecondaryStructure {
    private residueMap: Map<string, StructureType>;


    constructor() {
        this.residueMap = new Map<string, StructureType>();
    }

    private makeKey(chainID: string, residueNumber: number): string {
        return `${chainID}-${residueNumber}`;
    }

    setStructure(chainID: string, residueNumber: number, type: StructureType): void {
        this.residueMap.set(this.makeKey(chainID, residueNumber), type);
    }

    setRegion(chainID: string, startResidue: number, endResidue: number, type: StructureType): void {
        for (let i = startResidue; i <= endResidue; i++) {
            this.setStructure(chainID, i, type);
        }
    }

    getStructure(chainID: string, residueNumber: number): StructureType {
        const structure = this.residueMap.get(this.makeKey(chainID, residueNumber));
        return structure ?? StructureType.Loop;
    }

    hasAnyStructure() : boolean {
        return this.residueMap.size > 0;
    }
};