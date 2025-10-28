import { Atom } from "../../Shared/Atom";
import { CIFData, LoopData, SingleValue } from "../Interface/CIFInterface";
import { IProteinParser } from "../Interface/Parser";
import { CIFQuery } from "./CIFQuery";
import { Protein } from "../../Shared/Protein";

export class CIFParser implements IProteinParser {
    private atoms: Atom[];

    constructor() {
        this.atoms = [];
    }

    private parseLoop(lines: string[], startIndex: number): { loop: LoopData, category: string, endIndex: number } {
        let i = startIndex + 1;
        let columns = [];
        let rows = [];

        while (i < lines.length) {
            const curr = lines[i].trim();

            if (!curr || curr.startsWith("#")) {
                i++;
                continue;
            }
            else if (curr.startsWith("_")) {
                columns.push(lines[i].trim());
                i++;
            } else {
                break;
            }
        }

        if (columns.length === 0) {
            // TODO report error
        }

        const firstCol = columns[0];
        const category = firstCol.split('.')[0];

        while (i < lines.length) {
            const curr = lines[i].trim();

            if (!curr || curr.startsWith("#")) {
                i++;
                continue;
            }

            if (curr.startsWith("loop_") || curr.startsWith("_")) {
                break;
            }

            const values = this.splitRow(curr);
            const unquotedValues = values.map(v => this.unquote(v));

            rows.push(unquotedValues);
            i++;
        }



        return {
            loop: {
                columns: columns,
                rows: rows
            },
            category: category,
            endIndex: i
        };
    }

    private parseCIF(content: string): CIFData {
        const lines = content.split('\n');
        const cifData: CIFData = {
            dataBlockName: this.parseDataBlock(lines),
            loops: new Map<string, LoopData>(),
            singleValues: new Map<string, string>(),
            metadata: {}
        }

        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();

            if (line.startsWith('#') || line === '') {
                i++;
                continue;
            }

            if (line.startsWith('loop_')) {
                const result = this.parseLoop(lines, i);
                cifData.loops.set(result.category, result.loop);
                i = result.endIndex;
                continue;
            }

            if (line.startsWith('_')) {
                // Check if next line starts with semicolon (multiline value)
                if (i + 1 < lines.length && lines[i + 1].trim().startsWith(';')) {
                    const spaceIndex = line.indexOf(' ');
                    const key = spaceIndex === -1 ? line : line.substring(0, spaceIndex).trim();
                    const dotIndex = key.indexOf('.');

                    if (dotIndex !== -1) {
                        const result = this.parseMultilineValue(lines, i + 1);
                        const fullKey = key.substring(0);
                        cifData.singleValues.set(fullKey, result.value);
                        i = result.endIndex + 1;
                        continue;
                    }
                }

                const singleValue = this.parseSingleValue(line);
                if (singleValue) {
                    const key = `${singleValue.category}.${singleValue.field}`;
                    cifData.singleValues.set(key, singleValue.value);
                }
            }

            i++;
        }

        return cifData;
    }

    parse(content: string): Protein {
        const cifData = this.parseCIF(content);

        const query = new CIFQuery(cifData);
        return query.toProtein();
    }

    // parseWithValidation(content: string) : {
    //     data: CIFData
    //     errors: string[],
    //     warnings: string[]
    // } {

    // }

    query(content: string): CIFQuery {
        const cifData = this.parseCIF(content);
        return new CIFQuery(cifData);
    }


    private parseDataBlock(lines: string[]): string {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data_")) {
                return trimmed.split("data_")[1].trim();
            }
        }

        return "";
    }

    private parseSingleValue(line: string): SingleValue | null {
        const spaceIndex = line.indexOf(' ');
        if (spaceIndex === -1) return null;

        const key = line.substring(0, spaceIndex).trim();
        const value = line.substring(spaceIndex + 1).trim();

        const dotIndex = key.indexOf('.');
        if (dotIndex === -1) return null;

        const category = key.substring(0, dotIndex);
        const field = key.substring(dotIndex + 1);

        return { category, field, value };
    }

    private parseMultilineValue(lines: string[], startIndex: number): { value: string, endIndex: number } {
        let i = startIndex + 1;
        const valueLines: string[] = [];

        while (i < lines.length) {
            const line = lines[i];

            // Check if line starts with semicolon (end of multiline value)
            if (line.startsWith(';')) {
                return {
                    value: valueLines.join('\n'),
                    endIndex: i
                };
            }

            valueLines.push(line);
            i++;
        }

        // If we reach here, no closing semicolon was found
        return {
            value: valueLines.join('\n'),
            endIndex: i
        };
    }

    private splitRow(line: string): string[] {
        const values: string[] = []
        let current = ''
        let inQuote: string | null = null;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === "'" || char === '"') {
                if (inQuote === null) {
                    inQuote = char;
                } else if (inQuote === char) {
                    inQuote = null;
                } else {
                    current += char;
                }
            }
            else if ((char === ' ' || char === '\t') && inQuote === null) {
                if (current.length > 0) {
                    values.push(current);
                    current = '';
                }
            }
            else {
                current += char;
            }
        }

        if (current.length > 0) {
            values.push(current);
        }

        return values;
    }

    private unquote(value: string): string {
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
            return value.substring(1, value.length - 1);
        }
        return value;
    }

    private isMissingValue(value: string): boolean {
        return value === '.' || value === '?';
    }

}