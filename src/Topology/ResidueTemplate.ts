export type TemplateBond = [string, string];

export interface ResidueTemplate {
    code: string;
    name: string;
    atoms: string[];
    bonds: TemplateBond[];
};