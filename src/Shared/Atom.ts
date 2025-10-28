export interface Atom {
    element: string;
    atomName: string;
    x: number;
    y: number;
    z: number;
    residueName: string;
    residueNumber: number;
    chainID: string;
    serialNumber: number;
    bFactor?: number;
    altLoc?: string;  // Alternate location indicator (A, B, etc.) for multiple conformations
    occupancy?: number;  // Occupancy value (0.0-1.0)
    secondaryStructure?: 'H' | 'E' | 'C';  // H=Helix, E=Sheet, C=Coil/Loop
};