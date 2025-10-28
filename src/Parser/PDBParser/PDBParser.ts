import { inferBonds } from "../../Topology/BondInference";
import { Atom } from "../../Shared/Atom";
import { Protein, BackboneChain, annotateAtomsWithSecondaryStructure } from "../../Shared/Protein";
import { SecondaryStructure, StructureType } from "./SecondaryStructure";
import { IProteinParser } from "../Interface/Parser";



export class PDBParser implements IProteinParser {
    secondaryStructure: SecondaryStructure | null;

    constructor() {
        this.secondaryStructure = null; 
    }

    private parseAtom(line: string) : Atom {
        let atomName = line.substring(12, 16).trim();
        let altLoc = line.substring(16, 17).trim();  // Alternate location indicator
        let elemSymbol = line.substring(76, 78).trim();
        let residueName = line.substring(17, 20).trim();
        let chainID = line.substring(21, 22).trim();
        let residueNumber = Number(line.substring(22, 26).trim());
        let x = Number(line.substring(30, 38).trim());
        let y = Number(line.substring(38, 46).trim());
        let z = Number(line.substring(46, 54).trim());
        let occupancy = Number(line.substring(54, 60).trim());
        let bFactor = Number(line.substring(60, 66).trim());
        let serial =  Number(line.substring(6, 11).trim());

        return {
            element: elemSymbol,
            atomName: atomName,
            x: x,
            y: y,
            z: z,
            residueName: residueName,
            residueNumber: residueNumber,
            chainID: chainID,
            serialNumber: serial,
            bFactor: bFactor,
            altLoc: altLoc || undefined,
            occupancy: occupancy || undefined
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

        const startChain = line.substring(21, 22).trim();
        const startResidue = Number(line.substring(22, 26).trim());
        const endChain = line.substring(32, 33).trim();
        const endResidue = Number(line.substring(33, 37).trim());

        if (startChain !== endChain) {
            console.log(`  Skipping - different chains`);
            return;
        }

        this.secondaryStructure.setRegion(startChain, startResidue, endResidue, StructureType.Sheet);
    }

    private parseConect(line: string): [number, number][] {
        const src = Number(line.substring(7, 11).trim());
        const bonds: [number, number][] = [];
        for (let [s1, s2] of [[12, 16], [17, 21], [22, 26], [27, 31]]) {
            const substr = line.substring(s1, s2).trim();
            if (substr) bonds.push([src, Number(substr)]);
        }
        return bonds;
    }

    parse(pdbContent: string) : Protein {
        const atoms: Atom[] = [];
        const chainMap = new Map<string, Atom[]>();
        const conectRecords = new Map<number, number[]>();

        let title: string = "";
        this.secondaryStructure = new SecondaryStructure();
        for (const line of pdbContent.split("\n")) {
            if (line.startsWith("ATOM") || line.startsWith("HETATM")) {
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
            } else if (line.startsWith("CONECT")) {
                const entries = this.parseConect(line);
                for (let [src, dest] of entries) {
                    if (!conectRecords.has(src)) {
                        conectRecords.set(src, []);
                    }
                    conectRecords.get(src)!.push(dest);
                }
            } 
        }

        const bonds = inferBonds(atoms, conectRecords);
        const uniqueChains = new Set(atoms.map(atom => atom.chainID));
        const numChains = uniqueChains.size;
        const backboneChains: BackboneChain[] = Array.from(chainMap.entries()).map(([chainID, caAtoms]) => ({
            chainID,
            caAtoms: caAtoms.sort((a, b) => a.residueNumber - b.residueNumber)
        }));

        const protein = {
            atoms,
            bonds,
            name: title.length > 0 ? title.toLowerCase() : "unknown protein",
            numChains: numChains,
            secondaryStructure: this.secondaryStructure,
            backboneChains: backboneChains
        };

        // Annotate atoms with secondary structure
        annotateAtomsWithSecondaryStructure(protein);

        return protein;
    }
};

