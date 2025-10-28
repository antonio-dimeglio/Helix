// Represents a single, full mmCIF loop entry
export interface LoopData {
    columns: string[]; // Column name, e.g. "_atom_site.id"
    rows: string[][]; // raw data rows
}

// K-V pair for non loop-data
export interface SingleValue {
    category: string, // "_entry"
    field: string,  // "id"
    value: string  // "1HHO"
}


 // Main interface
export  interface CIFData {
    dataBlockName: string;
    loops: Map<string, LoopData>;
    singleValues: Map<string, string>;
    metadata: {
        version?: string;
        revisionData?: string;
        depositDate?: string;
    }
}

export interface AtomSiteRecord {
    groupPDB: 'ATOM' | 'HETATM'
    id: number                          // Serial number
    typeSymbol: string                  // Element symbol
    labelAtomId: string                 // Atom name (CA, N, O, etc.)
    labelAltId?: string                 // Alternate location indicator

    // Residue/Component
    labelCompId: string                 // Residue name (ALA, GLY, HEM, etc.)
    labelAsymId: string                 // Chain ID
    labelEntityId: string               // Entity ID
    labelSeqId?: number                 // Residue sequence number

    // Coordinates
    cartnX: number
    cartnY: number
    cartnZ: number

    // Quality
    occupancy?: number
    bIsoOrEquiv?: number                // B-factor

    // Optional
    authSeqId?: number                  // Author's residue number
    authCompId?: string                 // Author's residue name
    authAsymId?: string                 // Author's chain ID
    authAtomId?: string                 // Author's atom name

    pdbxPDBModelNum?: number            // Model number (for NMR)
}

/**
 * Helix record
*/
export interface StructConfRecord {
    confTypeId: string                  // HELX_P, HELX_OT_P, TURN_P, etc.
    id: string                          // Identifier
    begLabelAsymId: string              // Start chain
    begLabelSeqId: number               // Start residue
    endLabelAsymId: string              // End chain
    endLabelSeqId: number               // End residue
    pdbxPDBHelixClass?: string          // Helix type (1-10)
    details?: string
}

/**
 * Sheet record
 */
export interface StructSheetRecord {
    sheetId: string                     // Sheet identifier
    id: string                          // Range identifier
    begLabelAsymId: string
    begLabelSeqId: number
    endLabelAsymId: string
    endLabelSeqId: number
}

/**
 * Chemical component bond
 */
export interface ChemCompBondRecord {
    compId: string                      // Component ID (ALA, HEM, etc.)
    atomId1: string                     // First atom name
    atomId2: string                     // Second atom name
    valueOrder: 'SING' | 'DOUB' | 'TRIP' | 'QUAD' | 'AROM' | 'DELO' | 'PI'
    pdbxAromaticFlag?: 'Y' | 'N'
    pdbxStereoConfig?: 'E' | 'Z' | 'N'
}

/**
 * Chemical component info
 */
export interface ChemCompRecord {
    id: string
    name: string
    type: string                        // 'L-peptide linking', 'non-polymer', etc.
    formula?: string
    formulaWeight?: number
}

/**
 * Entity record
 */
export interface EntityRecord {
    id: string
    type: 'polymer' | 'non-polymer' | 'water'
    description?: string
    formulaWeight?: number
    pdbxNumberOfMolecules?: number
}

/**
 * Assembly (biological unit)
 */
export interface AssemblyRecord {
    id: string
    details?: string
    method?: string
    oligomericCount?: number
}

/**
 * Structural connection (links, disulfides, metal coordination)
 */
export interface StructConnRecord {
    id: string
    connTypeId: 'disulf' | 'metalc' | 'covale' | 'hydrog'

    ptnr1LabelAsymId: string            // Partner 1 chain
    ptnr1LabelSeqId: number             // Partner 1 residue
    ptnr1LabelAtomId: string            // Partner 1 atom
    ptnr1LabelCompId: string            // Partner 1 component

    ptnr2LabelAsymId: string            // Partner 2 chain
    ptnr2LabelSeqId: number
    ptnr2LabelAtomId: string
    ptnr2LabelCompId: string

    pdbxDist?: number                   // Distance
}

/**
 * Citation record
 */
export interface CitationRecord {
    id: string
    title?: string
    journalAbbrev?: string
    journalVolume?: string
    pageFirst?: string
    pageLast?: string
    year?: number
    pdbxDatabaseIdPubMed?: string
    pdbxDatabaseIdDOI?: string
}

/**
 * Model quality
 */
export interface ModelQualityRecord {
    rFree?: number
    rWork?: number
    resolution?: number
    completeness?: number
}

/**
 * Statistics summary
 */
export interface CIFStatistics {
    totalAtoms: number
    atomsByType: Record<string, number>     // Element -> count
    chains: string[]
    residueCount: number
    helixCount: number
    sheetCount: number
    ligandCount: number
    waterCount: number
    hasExplicitBonds: boolean
    hasSecondaryStructure: boolean
}

