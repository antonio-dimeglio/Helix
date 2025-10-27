/**
 * Script to download official RCSB PDB topology data and generate topology.json
 *
 * This downloads CIF files from ligand-expo.rcsb.org for all 20 standard amino acids
 * and extracts the bond connectivity information.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

// The 20 standard amino acids
const AMINO_ACIDS = [
    { code: 'ALA', name: 'Alanine' },
    { code: 'ARG', name: 'Arginine' },
    { code: 'ASN', name: 'Asparagine' },
    { code: 'ASP', name: 'Aspartate' },
    { code: 'CYS', name: 'Cysteine' },
    { code: 'GLN', name: 'Glutamine' },
    { code: 'GLU', name: 'Glutamate' },
    { code: 'GLY', name: 'Glycine' },
    { code: 'HIS', name: 'Histidine' },
    { code: 'ILE', name: 'Isoleucine' },
    { code: 'LEU', name: 'Leucine' },
    { code: 'LYS', name: 'Lysine' },
    { code: 'MET', name: 'Methionine' },
    { code: 'PHE', name: 'Phenylalanine' },
    { code: 'PRO', name: 'Proline' },
    { code: 'SER', name: 'Serine' },
    { code: 'THR', name: 'Threonine' },
    { code: 'TRP', name: 'Tryptophan' },
    { code: 'TYR', name: 'Tyrosine' },
    { code: 'VAL', name: 'Valine' }
];

async function downloadCIF(code) {
    const url = `http://ligand-expo.rcsb.org/reports/${code[0]}/${code}/${code}.cif`;
    console.log(`Downloading ${code} from ${url}...`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${code}: ${response.statusText}`);
    }

    return await response.text();
}

function parseCIF(cifText, code) {
    const lines = cifText.split('\n');
    const bonds = [];
    const atoms = new Set();

    // Find the bond table section
    let inBondSection = false;

    for (const line of lines) {
        // Start of bond section
        if (line.includes('_chem_comp_bond.comp_id')) {
            inBondSection = true;
            continue;
        }

        // End of bond section
        if (inBondSection && line.startsWith('#')) {
            break;
        }

        // Parse bond lines
        if (inBondSection && line.startsWith(code)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
                const atom1 = parts[1];
                const atom2 = parts[2];

                // Skip hydrogens for now (PDB files often don't have them)
                if (atom1.startsWith('H') || atom2.startsWith('H')) {
                    continue;
                }

                // Skip OXT (terminal oxygen, not always present)
                if (atom1 === 'OXT' || atom2 === 'OXT') {
                    continue;
                }

                atoms.add(atom1);
                atoms.add(atom2);
                bonds.push([atom1, atom2]);
            }
        }
    }

    return {
        code: code,
        name: AMINO_ACIDS.find(aa => aa.code === code)?.name || code,
        atoms: Array.from(atoms).sort(),
        bonds: bonds
    };
}

async function generateTopology() {
    console.log('Generating amino acid topology from RCSB PDB data...\n');

    const topology = {};

    for (const aa of AMINO_ACIDS) {
        try {
            const cifText = await downloadCIF(aa.code);
            const residueData = parseCIF(cifText, aa.code);
            topology[aa.code] = residueData;

            console.log(`✓ ${aa.code}: ${residueData.atoms.length} atoms, ${residueData.bonds.length} bonds`);
        } catch (error) {
            console.error(`✗ ${aa.code}: ${error.message}`);
        }
    }

    // Write to JSON file
    const outputPath = join(process.cwd(), 'src', 'Topology', 'topology.json');
    writeFileSync(outputPath, JSON.stringify(topology, null, 2));

    console.log(`\n✓ Topology written to: ${outputPath}`);
    console.log(`✓ Generated topology for ${Object.keys(topology).length} amino acids`);
}

// Run the generator
generateTopology().catch(console.error);
