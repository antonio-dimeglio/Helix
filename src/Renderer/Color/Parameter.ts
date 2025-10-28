export type ParameterType = 'range' | 'select' | 'checkbox' | 'color' | 'number';

export interface Parameter{
    name: string;
    label: string;
    type: ParameterType;
    defaultValue: any;

    // Range and Number type specific
    min?: number;
    max?: number;
    step?: number;

    // Select Type specific
    options?: string[];

    // Optional description
    description?: string;
};