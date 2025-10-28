import { AssemblyRecord, AtomSiteRecord, ChemCompBondRecord, ChemCompRecord, CIFData, CIFStatistics, CitationRecord, EntityRecord, LoopData, ModelQualityRecord, StructConfRecord, StructConnRecord, StructSheetRecord } from "../Interface/CIFInterface";
import { StructureType, SecondaryStructure } from "../PDBParser/SecondaryStructure";
import { Protein, annotateAtomsWithSecondaryStructure } from "../../Shared/Protein";
import { Atom } from "../../Shared/Atom";
import { inferBonds } from "../../Topology/BondInference";

export class CIFQuery {
    private data: CIFData;

    constructor(data: CIFData) {
        this.data = data;
    }

    hasLoop(category: string): boolean {
        return this.data.loops.has(category);
    }

    getLoop(category: string): LoopData | undefined {
        if (this.hasLoop(category)) return this.data.loops.get(category);
        return undefined;
    }

    getLoopCategories(): string[] {
        return Array.from(this.data.loops.keys());
    }

    getColumnIndex(category: string, fieldName: string): number {
        const loop = this.getLoop(category);
        if (!loop) return -1;

        let i = 0;
        for (const col of loop.columns) {
            if (col === `${category}.${fieldName}`) {
                return i;
            }
            i++;
        }

        return -1;
    }

    getColumnValues<T = string>(
        category: string,
        fieldName: string,
        parser?: (val: string) => T ): T[] {
        const colIdx = this.getColumnIndex(category, fieldName);
        if (colIdx === -1) return [];

        const loop = this.getLoop(category);
        if (!loop) return [];

        const results: T[] = [];
        for (const row of loop.rows) {
            const value = row[colIdx];

            if (parser) {
                results.push(parser(value));
            } else {
                results.push(value as T);
            }
        }

        return results;
    }

    getRowAsObject(category: string, rowIndex: number): Record<string, string> {
        const loop = this.getLoop(category);
        const result: Record<string, string> = {};
        if (!loop || rowIndex >= loop.rows.length) {
            return result;
        }

        for (let colIdx = 0; colIdx < loop.columns.length; colIdx++) {
            const col = loop.columns[colIdx];
            const fieldName = col.split('.')[1];
            const value = loop.rows[rowIndex][colIdx];

            result[fieldName] = value;
        }

        return result;
    }

    getAllRowsAsObjects(category: string): Record<string, string>[] {
        const loop = this.getLoop(category);
        if (!loop) return [];

        const results: Record<string, string>[] = [];
        for (let i = 0; i < loop.rows.length; i++) {
            const rowObj = this.getRowAsObject(category, i);
            results.push(rowObj);
        }

        return results;
    }

    filterRows(
        category: string,
        predicate: (row: Record<string, string>) => boolean
    ): Record<string, string>[] {
        const allRows = this.getAllRowsAsObjects(category);
        return allRows.filter(predicate);
    }

    getRowCount(category: string): number {
        const res = this.getLoop(category)?.rows.length 
        if (res) {
            return res;
        } else {
            return 0;
        }
    }

    getSingleValue(category: string, field: string): string | undefined {
        const key = `${category}.${field}`
        return this.data.singleValues.get(key);
    }

    getCategoryValues(category: string): Map<string, string> {
        const result = new Map<string, string>();
        // Get all single values that start with this category
        for (const [key, value] of this.data.singleValues.entries()) {
            if (key.startsWith(category + '.')) {
                const field = key.substring(category.length + 1);
                result.set(field, value);
            }
        }
        return result;
    }

    getAtoms(): AtomSiteRecord[] {
        const rows = this.getAllRowsAsObjects("_atom_site");
        const results: AtomSiteRecord[] = [];
        if (!rows) return results;

        for (const rowObj of rows) {
            results.push({
                groupPDB: rowObj.group_PDB as 'ATOM' | 'HETATM',
                id: Number(rowObj.id),
                typeSymbol: rowObj.type_symbol,
                labelAtomId: rowObj.label_atom_id,
                labelCompId: rowObj.label_comp_id,
                labelAsymId: rowObj.label_asym_id,
                labelEntityId: rowObj.label_entity_id || '1',
                labelSeqId: Number(rowObj.label_seq_id) || 0,
                cartnX: Number(rowObj.Cartn_x),
                cartnY: Number(rowObj.Cartn_y),
                cartnZ: Number(rowObj.Cartn_z),

                occupancy: rowObj.occupancy ? Number(rowObj.occupancy) : -1,
                bIsoOrEquiv: rowObj.B_iso_or_equiv ? Number(rowObj.B_iso_or_equiv) : -1
            });
        }

        return results;
    }

    getAtomsByGroup(group: 'ATOM' | 'HETATM'): AtomSiteRecord[] {
        return this.getAtoms().filter(atom => atom.groupPDB === group);
    }

    getAtomsByChain(chainId: string): AtomSiteRecord[] {
        return this.getAtoms().filter(atom => atom.labelAsymId === chainId);
    }

    getAtomsByResidue(chainId: string, seqId: number): AtomSiteRecord[] {
        return this.getAtoms().filter(atom =>
            atom.labelAsymId === chainId && atom.labelSeqId === seqId
        );
    }

    getCAAtoms(): AtomSiteRecord[] {
        return this.getAtoms().filter(atom => atom.labelAtomId === 'CA');
    }

    getHelices(): StructConfRecord[] {
        const rows = this.getAllRowsAsObjects("_struct_conf");
        const results: StructConfRecord[] = [];
        if (!rows) return results;

        for (const rowObj of rows) {
            // Only include helices (HELX_P, HELX_OT_P, etc.)
            if (!rowObj.conf_type_id || !rowObj.conf_type_id.startsWith('HELX')) {
                continue;
            }

            results.push({
                confTypeId: rowObj.conf_type_id,
                id: rowObj.id,
                begLabelAsymId: rowObj.beg_label_asym_id,
                begLabelSeqId: Number(rowObj.beg_label_seq_id),
                endLabelAsymId: rowObj.end_label_asym_id,
                endLabelSeqId: Number(rowObj.end_label_seq_id),
                pdbxPDBHelixClass: rowObj.pdbx_PDB_helix_class,
                details: rowObj.details
            });
        }

        return results;
    }

    getSheets(): StructSheetRecord[] {
        const rows = this.getAllRowsAsObjects("_struct_sheet_range");
        const results: StructSheetRecord[] = [];
        if (!rows) return results;

        for (const rowObj of rows) {
            results.push({
                sheetId: rowObj.sheet_id,
                id: rowObj.id,
                begLabelAsymId: rowObj.beg_label_asym_id,
                begLabelSeqId: Number(rowObj.beg_label_seq_id),
                endLabelAsymId: rowObj.end_label_asym_id,
                endLabelSeqId: Number(rowObj.end_label_seq_id)
            });
        }

        return results;
    }

    getSecondaryStructureType(chainId: string, seqId: number): StructureType {
        // Check helices
        const helices = this.getHelices();
        for (const helix of helices) {
            if (helix.begLabelAsymId === chainId &&
                seqId >= helix.begLabelSeqId &&
                seqId <= helix.endLabelSeqId) {
                return StructureType.Helix;
            }
        }

        // Check sheets
        const sheets = this.getSheets();
        for (const sheet of sheets) {
            if (sheet.begLabelAsymId === chainId &&
                seqId >= sheet.begLabelSeqId &&
                seqId <= sheet.endLabelSeqId) {
                return StructureType.Sheet;
            }
        }

        return StructureType.Loop;
    }

    getChemCompBonds(compId: string): ChemCompBondRecord[] {
        return []; // TODO: Implement _chem_comp_bond parsing
    }

    getChemCompIds(): string[] {
        return []; // TODO: Implement
    }

    getChemComp(compId: string): ChemCompRecord | undefined {
        return undefined; // TODO: Implement
    }

    getEntities(): EntityRecord[] {
        return []; // TODO: Implement _entity parsing
    }

    getEntityType(entityId: string): 'polymer' | 'non-polymer' | 'water' | undefined {
        return undefined; // TODO: Implement
    }

    getAssemblies(): AssemblyRecord[] {
        return []; // TODO: Implement
    }

    getTitle(): string | undefined {
        return this.getSingleValue('_struct', 'title');
    }

    getExperimentalMethod(): string[] {
        return []; // TODO: Implement _exptl parsing
    }

    getResolution(): number | undefined {
        return undefined; // TODO: Implement
    }

    getDepositionDate(): Date | undefined {
        return undefined; // TODO: Implement
    }

    getReleaseDate(): Date | undefined {
        return undefined; // TODO: Implement
    }

    getAuthors(): string[] {
        return []; // TODO: Implement
    }

    getCitations(): CitationRecord[] {
        return []; // TODO: Implement
    }

    getStructConnections(): StructConnRecord[] {
        return []; // TODO: Implement _struct_conn parsing
    }

    getDisulfideBonds(): StructConnRecord[] {
        return []; // TODO: Filter struct_conn for disulfides
    }

    getMetalBonds(): StructConnRecord[] {
        return []; // TODO: Filter struct_conn for metal coordination
    }

    getBFactors(): Map<number, number> {
        const result = new Map<number, number>();
        const atoms = this.getAtoms();
        for (const atom of atoms) {
            if (atom.bIsoOrEquiv !== undefined) {
                result.set(atom.id, atom.bIsoOrEquiv);
            }
        }
        return result;
    }

    getOccupancies(): Map<number, number> {
        const result = new Map<number, number>();
        const atoms = this.getAtoms();
        for (const atom of atoms) {
            if (atom.occupancy !== undefined) {
                result.set(atom.id, atom.occupancy);
            }
        }
        return result;
    }

    getModelQuality(): ModelQualityRecord | undefined {
        return undefined; // TODO: Implement
    }

    toProtein(): Protein {
        const atoms: Atom[] = []
        const atomSiteRecords = this.getAtoms();

        // Convert AtomSiteRecord to Atom
        for (const record of atomSiteRecords) {
            const atom: Atom = {
                serialNumber: record.id,
                element: record.typeSymbol,
                atomName: record.labelAtomId,
                residueName: record.labelCompId,
                chainID: record.labelAsymId,
                residueNumber: record.labelSeqId || 0,
                x: record.cartnX,
                y: record.cartnY,
                z: record.cartnZ,
                bFactor: record.bIsoOrEquiv !== -1 ? record.bIsoOrEquiv : undefined,
                altLoc: record.labelAltId,
                occupancy: record.occupancy !== -1 ? record.occupancy : undefined
            }
            atoms.push(atom);
        }

        // Build backbone chains (CA atoms only)
        const chainMap = new Map<string, Atom[]>();
        for (const atom of atoms) {
            if (atom.atomName === 'CA') {
                if (!chainMap.has(atom.chainID)) {
                    chainMap.set(atom.chainID, []);
                }
                chainMap.get(atom.chainID)!.push(atom);
            }
        }

        const backboneChains = Array.from(chainMap.entries()).map(([chainID, caAtoms]) => ({
            chainID,
            caAtoms: caAtoms.sort((a, b) => a.residueNumber - b.residueNumber)
        }));

        // Infer bonds (no explicit bonds from mmCIF yet)
        const bonds = inferBonds(atoms, new Map());

        // Get unique chains
        const uniqueChains = new Set(atoms.map(atom => atom.chainID));

        // Get title
        const title = this.getSingleValue('_struct', 'title') || this.data.dataBlockName || 'unknown';

        // Build secondary structure from helices and sheets
        const secondaryStructure = new SecondaryStructure();

        // Add helices
        const helices = this.getHelices();
        for (const helix of helices) {
            secondaryStructure.setRegion(
                helix.begLabelAsymId,
                helix.begLabelSeqId,
                helix.endLabelSeqId,
                StructureType.Helix
            );
        }

        // Add sheets
        const sheets = this.getSheets();
        for (const sheet of sheets) {
            secondaryStructure.setRegion(
                sheet.begLabelAsymId,
                sheet.begLabelSeqId,
                sheet.endLabelSeqId,
                StructureType.Sheet
            );
        }

        const protein = {
            atoms,
            bonds,
            name: title.toLowerCase(),
            numChains: uniqueChains.size,
            secondaryStructure,
            backboneChains
        };

        // Annotate atoms with secondary structure
        annotateAtomsWithSecondaryStructure(protein);

        return protein;
    }

    toJSON(): object {
        return {
            dataBlockName: this.data.dataBlockName,
            loopCategories: this.getLoopCategories(),
            atomCount: this.getAtoms().length,
            // Add more as needed
        };
    }

    getStatistics(): CIFStatistics {
        const atoms = this.getAtoms();
        const atomsByType: Record<string, number> = {};
        const chains = new Set<string>();
        const residues = new Set<string>();
        let waterCount = 0;
        let ligandCount = 0;

        for (const atom of atoms) {
            // Count by element
            atomsByType[atom.typeSymbol] = (atomsByType[atom.typeSymbol] || 0) + 1;

            // Track chains
            chains.add(atom.labelAsymId);

            // Track residues
            residues.add(`${atom.labelAsymId}-${atom.labelSeqId}`);

            // Count water
            if (atom.labelCompId === 'HOH') {
                waterCount++;
            }

            // Count ligands (HETATM but not water)
            if (atom.groupPDB === 'HETATM' && atom.labelCompId !== 'HOH') {
                ligandCount++;
            }
        }

        return {
            totalAtoms: atoms.length,
            atomsByType,
            chains: Array.from(chains),
            residueCount: residues.size,
            helixCount: this.getHelices().length,
            sheetCount: this.getSheets().length,
            ligandCount,
            waterCount,
            hasExplicitBonds: this.hasLoop('_chem_comp_bond'),
            hasSecondaryStructure: this.hasLoop('_struct_conf') || this.hasLoop('_struct_sheet_range')
        };
    }

}   