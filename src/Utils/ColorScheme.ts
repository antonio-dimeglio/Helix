// CPK (Corey-Pauling-Koltun) - Standard element colors
export const ELEMENT_COLORS_CPK: Record<string, number> = {
    'C': 0x909090,  // Carbon - gray
    'N': 0x3050F8,  // Nitrogen - blue
    'O': 0xFF0D0D,  // Oxygen - red
    'S': 0xFFFF30,  // Sulfur - yellow
    'H': 0xFFFFFF,  // Hydrogen - white
    'P': 0xFF8000,  // Phosphorus - orange
    'F': 0x90E050,  // Fluorine - green
    'CL': 0x1FF01F, // Chlorine - green
    'BR': 0xA62929, // Bromine - dark red
    'I': 0x940094,  // Iodine - purple
    'FE': 0xE06633, // Iron - orange
    'CA': 0x3DFF00, // Calcium - green
};

// Rasmol - Alternative element colors (black carbon)
export const ELEMENT_COLORS_RASMOL: Record<string, number> = {
    'C': 0x000000,  // Carbon - black
    'N': 0x8F8FFF,  // Nitrogen - light blue
    'O': 0xFF4500,  // Oxygen - orange-red
    'S': 0xFFC832,  // Sulfur - gold
    'H': 0xFFFFFF,  // Hydrogen - white
    'P': 0xFFA500,  // Phosphorus - orange
    'F': 0xDAA520,  // Fluorine - goldenrod
    'CL': 0x00FF00, // Chlorine - green
    'BR': 0xA52A2A, // Bromine - brown
    'I': 0x9400D3,  // Iodine - dark violet
    'FE': 0xFFA500, // Iron - orange
    'CA': 0x808090, // Calcium - gray
};

// Jmol - Modern element colors
export const ELEMENT_COLORS_JMOL: Record<string, number> = {
    'C': 0x909090,  // Carbon - gray (same as CPK)
    'N': 0x3050F8,  // Nitrogen - blue
    'O': 0xFF0D0D,  // Oxygen - red
    'S': 0xFFFF30,  // Sulfur - yellow
    'H': 0xFFFFFF,  // Hydrogen - white
    'P': 0xFF8000,  // Phosphorus - orange
    'F': 0x90E050,  // Fluorine - light green
    'CL': 0x1FF01F, // Chlorine - green
    'BR': 0xA62929, // Bromine - dark red
    'I': 0x940094,  // Iodine - purple
    'FE': 0xE06633, // Iron - orange
    'CA': 0x3DFF00, // Calcium - green
};

// Default to CPK for backwards compatibility
export const ELEMENT_COLORS: Record<string, number> = ELEMENT_COLORS_CPK;

// Chain colors - distinct palette for different chains
export const CHAIN_COLORS: number[] = [
    0xFF6B6B,  // Red
    0x4ECDC4,  // Cyan
    0xFFE66D,  // Yellow
    0x95E1D3,  // Mint
    0xF38181,  // Light red
    0xAA96DA,  // Purple
    0xFCBF49,  // Orange
    0x06FFA5,  // Green
    0x5B9BD5,  // Blue
    0xED6A5A,  // Coral
];

// Residue colors based on chemical properties (Shapely-like scheme)
export const RESIDUE_COLORS: Record<string, number> = {
    // Hydrophobic (nonpolar) - Gray/White
    'ALA': 0xC8C8C8,  // Alanine
    'VAL': 0xC8C8C8,  // Valine
    'ILE': 0xC8C8C8,  // Isoleucine
    'LEU': 0xC8C8C8,  // Leucine
    'MET': 0xC8C8C8,  // Methionine
    'PHE': 0xC8C8C8,  // Phenylalanine
    'TRP': 0xC8C8C8,  // Tryptophan
    'PRO': 0xDC9682,  // Proline - special (rigid)

    // Polar uncharged - Green
    'SER': 0x00FF00,  // Serine
    'THR': 0x00FF00,  // Threonine
    'CYS': 0x00FF00,  // Cysteine
    'ASN': 0x00FF00,  // Asparagine
    'GLN': 0x00FF00,  // Glutamine
    'TYR': 0x00FF00,  // Tyrosine

    // Acidic (negatively charged) - Red
    'ASP': 0xFF0000,  // Aspartate
    'GLU': 0xFF0000,  // Glutamate

    // Basic (positively charged) - Blue
    'LYS': 0x0000FF,  // Lysine
    'ARG': 0x0000FF,  // Arginine
    'HIS': 0x0000FF,  // Histidine

    // Special - Yellow/Orange
    'GLY': 0xFFFF00,  // Glycine - small, flexible
};

export function getChainColor(chainID: string): number {
    // Convert chain ID to index (A=0, B=1, etc.)
    const charCode = chainID.charCodeAt(0);
    const index = charCode >= 65 && charCode <= 90
        ? charCode - 65  // A-Z
        : charCode - 97; // a-z
    return CHAIN_COLORS[index % CHAIN_COLORS.length];
}

export function getResidueColor(residueName: string): number {
    return RESIDUE_COLORS[residueName] || 0x808080; // Default gray for unknown
}

export function getElementColor(element: string, preset: string = 'CPK'): number {
    let colorMap: Record<string, number>;

    switch (preset.toUpperCase()) {
        case 'RASMOL':
            colorMap = ELEMENT_COLORS_RASMOL;
            break;
        case 'JMOL':
            colorMap = ELEMENT_COLORS_JMOL;
            break;
        case 'CPK':
        default:
            colorMap = ELEMENT_COLORS_CPK;
            break;
    }

    return colorMap[element] || 0xFF00FF; // Default magenta for unknown
}