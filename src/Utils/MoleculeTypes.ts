import { Atom } from "../Shared/Atom";

/**
 * DNA nucleotide residue names
 */
const DNA_RESIDUES = new Set([
    'DA', 'DT', 'DG', 'DC', 'DU',  // Standard DNA
    'A', 'T', 'G', 'C', 'U'         // Sometimes without 'D' prefix
]);

/**
 * RNA nucleotide residue names
 */
const RNA_RESIDUES = new Set([
    'A', 'U', 'G', 'C'
]);

/**
 * Standard amino acid residue names
 */
const PROTEIN_RESIDUES = new Set([
    'ALA', 'ARG', 'ASN', 'ASP', 'CYS',
    'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
    'LEU', 'LYS', 'MET', 'PHE', 'PRO',
    'SER', 'THR', 'TRP', 'TYR', 'VAL',
    // Modified/unusual
    'MSE', 'SEP', 'TPO', 'PTR', 'HYP'
]);

/**
 * Check if an atom belongs to a protein residue
 */
export function isProteinAtom(atom: Atom): boolean {
    return PROTEIN_RESIDUES.has(atom.residueName);
}

/**
 * Check if an atom belongs to a DNA residue
 */
export function isDNAAtom(atom: Atom): boolean {
    return DNA_RESIDUES.has(atom.residueName);
}

/**
 * Check if an atom belongs to an RNA residue
 */
export function isRNAAtom(atom: Atom): boolean {
    // RNA is harder to distinguish from DNA in some formats
    // For now, treat as DNA
    return RNA_RESIDUES.has(atom.residueName);
}

/**
 * Check if an atom belongs to a nucleic acid (DNA or RNA)
 */
export function isNucleicAcidAtom(atom: Atom): boolean {
    return isDNAAtom(atom) || isRNAAtom(atom);
}

/**
 * Check if an atom is water
 */
export function isWaterAtom(atom: Atom): boolean {
    return atom.residueName === 'HOH' || atom.residueName === 'WAT';
}

/**
 * Check if an atom is a ligand/heteroatom (not protein, not nucleic acid, not water)
 */
export function isLigandAtom(atom: Atom): boolean {
    return !isProteinAtom(atom) && !isNucleicAcidAtom(atom) && !isWaterAtom(atom);
}
