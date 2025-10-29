import { Protein, AtomBond } from "../../Shared/Protein";
import { Atom } from "../../Shared/Atom";
import { SecondaryStructure } from "../PDBParser/SecondaryStructure";

/**
 * Parser for MOL2 (Tripos Mol2) format
 * Used for small molecules with detailed chemical information
 */
export class MOL2Parser {
    /**
     * Parse MOL2 file content
     * @param content - Raw MOL2 file content
     * @param moleculeName - Optional name override
     * @returns Protein object (reusing structure for small molecules)
     */
    public parse(content: string, moleculeName?: string): Protein {
        const lines = content.split('\n');

        let name = moleculeName || "Unknown Molecule";
        const atoms: Atom[] = [];
        const bonds: AtomBond[] = [];

        let currentSection = '';
        let atomCount = 0;
        let bondCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detect section headers
            if (line.startsWith('@<TRIPOS>')) {
                currentSection = line.substring(9); // Remove '@<TRIPOS>'
                continue;
            }

            // Skip empty lines and comments
            if (!line || line.startsWith('#')) continue;

            // Parse based on current section
            switch (currentSection) {
                case 'MOLECULE':
                    // First line after @<TRIPOS>MOLECULE is the molecule name
                    if (atomCount === 0 && !moleculeName) {
                        name = line;
                    }
                    // Second line contains counts: num_atoms num_bonds num_subst num_feat num_sets
                    else {
                        const parts = line.split(/\s+/);
                        if (parts.length >= 2) {
                            atomCount = parseInt(parts[0]) || 0;
                            bondCount = parseInt(parts[1]) || 0;
                        }
                    }
                    break;

                case 'ATOM':
                    // Format: atom_id atom_name x y z atom_type [subst_id [subst_name [charge [status_bit]]]]
                    const atomParts = line.split(/\s+/);
                    if (atomParts.length >= 6) {
                        try {
                            const atomId = parseInt(atomParts[0]);
                            const atomName = atomParts[1];
                            const x = parseFloat(atomParts[2]);
                            const y = parseFloat(atomParts[3]);
                            const z = parseFloat(atomParts[4]);
                            const atomType = atomParts[5]; // e.g., C.3, N.ar, O.2

                            // Extract element from atom type (first part before '.')
                            const element = atomType.split('.')[0];

                            // Parse charge if present (9th field)
                            let charge: number | undefined = undefined;
                            if (atomParts.length >= 9) {
                                const chargeVal = parseFloat(atomParts[8]);
                                if (!isNaN(chargeVal) && chargeVal !== 0) {
                                    charge = chargeVal;
                                }
                            }

                            const atom: Atom = {
                                element,
                                atomName: atomName || `${element}${atomId}`,
                                x,
                                y,
                                z,
                                residueName: name.substring(0, 3).toUpperCase(),
                                residueNumber: 1,
                                chainID: 'A',
                                serialNumber: atomId,
                            };

                            // Add charge if present
                            if (charge !== undefined) {
                                (atom as any).charge = charge;
                            }

                            atoms.push(atom);
                        } catch (error) {
                            console.warn(`MOL2 Parser: Failed to parse atom line: ${line}`, error);
                        }
                    }
                    break;

                case 'BOND':
                    // Format: bond_id origin_atom_id target_atom_id bond_type [status_bits]
                    const bondParts = line.split(/\s+/);
                    if (bondParts.length >= 4) {
                        try {
                            const atom1 = parseInt(bondParts[1]);
                            const atom2 = parseInt(bondParts[2]);
                            const bondType = bondParts[3]; // 1, 2, 3, ar, am, du, un, nc

                            if (atom1 > 0 && atom2 > 0 && atom1 <= atoms.length && atom2 <= atoms.length) {
                                // Store bond as 0-indexed
                                bonds.push([atom1 - 1, atom2 - 1]);
                            }
                        } catch (error) {
                            console.warn(`MOL2 Parser: Failed to parse bond line: ${line}`, error);
                        }
                    }
                    break;

                // Ignore other sections like SUBSTRUCTURE, COMMENT, etc.
                default:
                    break;
            }
        }

        console.log(`MOL2 Parser: Parsed ${atoms.length} atoms, ${bonds.length} bonds for ${name}`);

        return {
            name,
            atoms,
            bonds,
            numChains: 1,
            secondaryStructure: new SecondaryStructure(),
            backboneChains: [],
        };
    }
}
