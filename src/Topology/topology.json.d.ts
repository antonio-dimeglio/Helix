import { ResidueTemplate } from './ResidueTemplate';

declare module './topology.json' {
    const value: Record<string, ResidueTemplate>;
    export default value;
}