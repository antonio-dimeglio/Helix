import { Protein, AtomBond } from "../../Shared/Protein";
import { Atom } from "../../Shared/Atom";
import { SecondaryStructure } from "../PDBParser/SecondaryStructure";

/**
 * Parser for SDF (Structure Data File) and MOL formats
 * Supports V2000 and V3000 formats
 */
export class SDFParser {
    /**
     * Parse SDF/MOL file content
     * @param content - Raw SDF/MOL file content
     * @param moleculeName - Optional name override
     * @returns Protein object (reusing structure for small molecules)
     */
    public parse(content: string, moleculeName?: string): Protein {
        const lines = content.split('\n').map(line => line.trim());

        // SDF format:
        // Line 1: Molecule name
        // Line 2: Software/user info (skip)
        // Line 3: Comment (skip)
        // Line 4: Counts line: aaabbblllfffcccsssxxxrrrpppiiimmmvvvvvv
        //   aaa = number of atoms
        //   bbb = number of bonds
        //   lll = number of atom lists (skip)
        //   fff = obsolete
        //   ccc = chiral flag
        //   sss = number of stext entries
        //   xxx = obsolete
        //   rrr = obsolete
        //   ppp = obsolete
        //   iii = obsolete
        //   mmm = number of lines of additional properties
        //   vvvvvv = version (V2000 or V3000)

        const name = moleculeName || lines[0] || "Unknown Molecule";

        // Find counts line (should be line 3, 0-indexed)
        let atomCount = 0;
        let bondCount = 0;
        let atomStartLine = 4; // Atoms start at line 4 (0-indexed)
        let isV3000 = false;

        if (lines.length > 3) {
            const countsLine = lines[3];
            // Check for V3000 format
            if (countsLine.includes('V3000')) {
                isV3000 = true;
                return this.parseV3000(lines, name);
            }

            // V2000 format
            atomCount = parseInt(countsLine.substring(0, 3).trim()) || 0;
            bondCount = parseInt(countsLine.substring(3, 6).trim()) || 0;
        }

        const atoms: Atom[] = [];
        const bonds: AtomBond[] = [];

        // Parse atoms (V2000 format)
        // Each atom line: xxxxx.xxxxyyyyy.yyyyzzzzz.zzzz aaaddcccssshhhbbbvvvHHHrrriiimmmnnneee
        //   x,y,z = coordinates
        //   aaa = atom symbol (right justified)
        //   dd = mass difference
        //   ccc = charge
        //   sss = atom stereo parity
        for (let i = 0; i < atomCount; i++) {
            const lineIdx = atomStartLine + i;
            if (lineIdx >= lines.length) break;

            const atomLine = lines[lineIdx];
            if (!atomLine || atomLine.startsWith('M  ')) break;

            try {
                // Parse by splitting on whitespace (more flexible for different SDF formats)
                const parts = atomLine.trim().split(/\s+/);

                // Expected format: x y z element [mass_diff charge ...]
                if (parts.length < 4) {
                    console.warn(`SDF Parser: Skipping malformed line ${i + 1}: "${atomLine}"`);
                    continue;
                }

                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                const z = parseFloat(parts[2]);
                const element = parts[3]; // Element symbol is the 4th field

                // Charge information (varies by format)
                // In V2000: field 6 (0-indexed field 5) contains charge code
                // 0 = uncharged, 1 = +3, 2 = +2, 3 = +1, 4 = doublet radical, 5 = -1, 6 = -2, 7 = -3
                let charge: number | undefined = undefined;
                if (parts.length > 5) {
                    const chargeCode = parseInt(parts[5]);
                    if (!isNaN(chargeCode)) {
                        const chargeMap: { [key: number]: number } = {
                            0: 0, 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3
                        };
                        charge = chargeMap[chargeCode];
                    }
                }

                const atom: Atom = {
                    element: element || 'C',
                    atomName: `${element}${i + 1}`,
                    x,
                    y,
                    z,
                    residueName: name.substring(0, 3).toUpperCase(),
                    residueNumber: 1,
                    chainID: 'A',
                    serialNumber: i + 1,
                };

                // Add charge if present
                if (charge !== undefined && charge !== 0) {
                    (atom as any).charge = charge;
                }

                atoms.push(atom);
            } catch (error) {
                console.warn(`Failed to parse atom line ${i + 1}:`, atomLine, error);
            }
        }

        // Parse bonds (V2000 format)
        // Each bond line: 111222tttsssxxxrrrccc
        //   111 = first atom number
        //   222 = second atom number
        //   ttt = bond type (1=single, 2=double, 3=triple, 4=aromatic)
        //   sss = bond stereo
        const bondStartLine = atomStartLine + atomCount;

        for (let i = 0; i < bondCount; i++) {
            const lineIdx = bondStartLine + i;
            if (lineIdx >= lines.length) break;

            const bondLine = lines[lineIdx];
            if (!bondLine || bondLine.startsWith('M  ')) break;

            try {
                const atom1 = parseInt(bondLine.substring(0, 3).trim());
                const atom2 = parseInt(bondLine.substring(3, 6).trim());
                const bondType = parseInt(bondLine.substring(6, 9).trim()) || 1;

                if (atom1 > 0 && atom2 > 0 && atom1 <= atoms.length && atom2 <= atoms.length) {
                    // Store bond as 0-indexed
                    bonds.push([atom1 - 1, atom2 - 1]);

                    // For double/triple bonds, could store bond order in future
                    // For now, just connectivity
                }
            } catch (error) {
                console.warn(`Failed to parse bond line ${i + 1}:`, bondLine, error);
            }
        }

        console.log(`SDF Parser: Parsed ${atoms.length} atoms, ${bonds.length} bonds for ${name}`);

        return {
            name,
            atoms,
            bonds,
            numChains: 1,
            secondaryStructure: new SecondaryStructure(),
            backboneChains: [],
        };
    }

    /**
     * Parse V3000 format (modern SDF format)
     */
    private parseV3000(lines: string[], name: string): Protein {
        console.warn('V3000 format detected - using basic parsing');

        const atoms: Atom[] = [];
        const bonds: AtomBond[] = [];

        let inAtomBlock = false;
        let inBondBlock = false;

        for (const line of lines) {
            if (line.includes('BEGIN ATOM')) {
                inAtomBlock = true;
                continue;
            }
            if (line.includes('END ATOM')) {
                inAtomBlock = false;
                continue;
            }
            if (line.includes('BEGIN BOND')) {
                inBondBlock = true;
                continue;
            }
            if (line.includes('END BOND')) {
                inBondBlock = false;
                continue;
            }

            if (inAtomBlock && line.startsWith('M  V30')) {
                // V3000 atom line: M  V30 index type x y z aaMap [CHG=charge] ...
                const parts = line.substring(7).trim().split(/\s+/);
                if (parts.length >= 5) {
                    try {
                        const idx = parseInt(parts[0]);
                        const element = parts[1];
                        const x = parseFloat(parts[2]);
                        const y = parseFloat(parts[3]);
                        const z = parseFloat(parts[4]);

                        const atom: Atom = {
                            element,
                            atomName: `${element}${idx}`,
                            x, y, z,
                            residueName: name.substring(0, 3).toUpperCase(),
                            residueNumber: 1,
                            chainID: 'A',
                            serialNumber: idx,
                        };

                        atoms.push(atom);
                    } catch (error) {
                        console.warn('Failed to parse V3000 atom:', line);
                    }
                }
            }

            if (inBondBlock && line.startsWith('M  V30')) {
                // V3000 bond line: M  V30 index type atom1 atom2 ...
                const parts = line.substring(7).trim().split(/\s+/);
                if (parts.length >= 4) {
                    try {
                        const atom1 = parseInt(parts[2]);
                        const atom2 = parseInt(parts[3]);
                        bonds.push([atom1 - 1, atom2 - 1]);
                    } catch (error) {
                        console.warn('Failed to parse V3000 bond:', line);
                    }
                }
            }
        }

        console.log(`SDF Parser (V3000): Parsed ${atoms.length} atoms, ${bonds.length} bonds`);

        return {
            name,
            atoms,
            bonds,
            numChains: 1,
            secondaryStructure: new SecondaryStructure(),
            backboneChains: [],
        };
    }

    /**
     * Parse multi-molecule SDF file (separated by $$$$)
     * @param content - Raw SDF file content with multiple molecules
     * @returns Array of Protein objects
     */
    public parseMultiple(content: string): Protein[] {
        const molecules: Protein[] = [];
        const molBlocks = content.split('$$$$');

        for (let i = 0; i < molBlocks.length; i++) {
            const block = molBlocks[i].trim();
            if (block.length > 0) {
                try {
                    const protein = this.parse(block);
                    molecules.push(protein);
                } catch (error) {
                    console.warn(`Failed to parse molecule ${i + 1}:`, error);
                }
            }
        }

        return molecules;
    }
}
