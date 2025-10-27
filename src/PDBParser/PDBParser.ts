import { inferBonds } from "../Topology/BondInference";
import { Atom } from "./Atom";
import { Protein, BackboneChain } from "./Protein";
import { SecondaryStructure, StructureType } from "./SecondaryStructure";



export class PDBParser {
    secondaryStructure: SecondaryStructure | null;

    constructor() {
        this.secondaryStructure = null; 
    }

    private parseAtom(line: string) : Atom {
        let atomName = line.substring(12, 16).trim();
        let elemSymbol = line.substring(76, 78).trim();
        let residueName = line.substring(17, 20).trim();
        let chainID = line.substring(21, 22).trim();
        let residueNumber = Number(line.substring(22, 26).trim()); 
        let x = Number(line.substring(30, 38).trim());
        let y = Number(line.substring(38, 46).trim());
        let z = Number(line.substring(46, 54).trim());

        return {
            element: elemSymbol,
            atomName: atomName,
            x: x,
            y: y,
            z: z,
            residueName: residueName,
            residueNumber: residueNumber,
            chainID: chainID
        }
    }

    private parseSecondary(line: string): [string, number, string, number] {
        const startChain = line.substring(19, 20).trim();
        const startResidue = Number(line.substring(21, 25).trim());
        const endChain = line.substring(31, 32).trim();
        const endResidue = Number(line.substring(33, 37).trim());

        return [
            startChain,
            startResidue,
            endChain,
            endResidue
        ];
    }

    private parseHelix(line: string){
        if (!this.secondaryStructure) {
            return;
        }
        const secondary = this.parseSecondary(line);
        if (secondary[0] != secondary[2]) {
            return;
        }

        this.secondaryStructure.setRegion(secondary[0], secondary[1], secondary[3], StructureType.Helix);
    }

    private parseSheet(line: string) {
        if (!this.secondaryStructure) {
            return;
        }
        // SHEET format is different from HELIX!
        const startChain = line.substring(21, 22).trim();
        const startResidue = Number(line.substring(22, 26).trim());
        const endChain = line.substring(32, 33).trim();
        const endResidue = Number(line.substring(33, 37).trim());

        console.log(`SHEET: chain ${startChain}, residues ${startResidue}-${endResidue}, endChain: ${endChain}`);

        if (startChain !== endChain) {
            console.log(`  Skipping - different chains`);
            return;
        }

        this.secondaryStructure.setRegion(startChain, startResidue, endResidue, StructureType.Sheet);
    }


    parsePDB(pdbContent: string) : Protein {
        const atoms: Atom[] = [];
        const chainMap = new Map<string, Atom[]>();

        let title: string = "";
        this.secondaryStructure = new SecondaryStructure();
        for (const line of pdbContent.split("\n")) {
            if (line.startsWith("ATOM")) {
                const atom = this.parseAtom(line);
                atoms.push(atom);
                if (atom.atomName === 'CA') {
                    if (!chainMap.has(atom.chainID)) {
                        chainMap.set(atom.chainID, []);
                    }
                    chainMap.get(atom.chainID)!.push(atom);
                }
            } else if (line.startsWith("HELIX")) {
                this.parseHelix(line);
            } else if (line.startsWith("SHEET")) {
                this.parseSheet(line);
            } else if (line.startsWith("TITLE")) {
                const titlePart = line.substring(10).trim();
                if (title.length > 0) {
                    title += " ";
                }
                title += titlePart;

            }
        }


        const bonds = inferBonds(atoms);
        const uniqueChains = new Set(atoms.map(atom => atom.chainID));
        const numChains = uniqueChains.size;
        const backboneChains: BackboneChain[] = Array.from(chainMap.entries()).map(([chainID, caAtoms]) => ({
            chainID,
            caAtoms: caAtoms.sort((a, b) => a.residueNumber - b.residueNumber)
        }));

        return {
            atoms,
            bonds,
            name: title.length > 0 ? title.toLowerCase() : "unknown protein",
            numChains: numChains,
            secondaryStructure: this.secondaryStructure,
            backboneChains: backboneChains
        };
    }
};

