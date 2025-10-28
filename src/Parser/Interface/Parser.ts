import { Protein } from "../../Shared/Protein";

export interface IProteinParser {
    parse(content: string): Protein;
}