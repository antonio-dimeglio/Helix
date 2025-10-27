import { Color, InstancedMesh, Matrix4, SphereGeometry, MeshLambertMaterial } from "three";
import { Atom } from "../PDBParser/Atom";
import { getChainColor, getElementColor, getResidueColor } from "../Utils/ColorScheme";
import { RenderMode } from "./RenderMode";

const RADIUS = 0.3;
const WIDTH = 8;
const HEIGHT = 8;


export enum ColorMode {
    Element = "element",
    Chain = "chain",
    Residue = "residue",
    SecondaryStructure = "secondary",
    Rainbow = "rainbow",
    Hydrophobicity = "hydrophobicity"
};

export const ColorModeCompatibility: Record<ColorMode, RenderMode[]> = {
    [ColorMode.Element]: [RenderMode.BallAndStick, RenderMode.Wireframe, RenderMode.SpaceFill],
    [ColorMode.Chain]: [RenderMode.BallAndStick, RenderMode.Wireframe, RenderMode.SpaceFill, RenderMode.Cartoon],
    [ColorMode.Residue]: [RenderMode.BallAndStick, RenderMode.Wireframe, RenderMode.SpaceFill],
    [ColorMode.SecondaryStructure]: [RenderMode.Cartoon],
    [ColorMode.Rainbow]: [RenderMode.Cartoon],
    [ColorMode.Hydrophobicity]: [RenderMode.Cartoon],
}

export const ColorDispatch: Record<ColorMode, (atom: Atom) => number> = {
    [ColorMode.Element]: (atom) => getElementColor(atom.element),
    [ColorMode.Chain]: (atom) => getChainColor(atom.chainID),
    [ColorMode.Residue]: (atom) => getResidueColor(atom.residueName),
    [ColorMode.SecondaryStructure]: (atom) => 0x808080, // Gray placeholder
    [ColorMode.Rainbow]: (atom) => 0x808080, // Gray placeholder
    [ColorMode.Hydrophobicity]: (atom) => 0x808080, // Gray placeholder
};

export function createAtomsMesh(
    atoms: Atom[],
    colorMode: ColorMode = ColorMode.Element,
    radius = RADIUS,
    width = WIDTH,
    height = HEIGHT) : InstancedMesh {
    const count = atoms.length;
    const geometry = new SphereGeometry(radius, width, height);
    const material = new MeshLambertMaterial();
    const instancedMesh = new InstancedMesh(geometry, material, count);

    const matrix = new Matrix4();
    const color = new Color();

    atoms.forEach((atom, i) => {
        matrix.makeTranslation(atom.x, atom.y, atom.z);
        instancedMesh.setMatrixAt(i, matrix);

        const colorValue = ColorDispatch[colorMode](atom);
        color.setHex(colorValue);
        instancedMesh.setColorAt(i, color);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;

    // instanceColor is created lazily by setColorAt, ensure it's updated
    instancedMesh.instanceColor!.needsUpdate = true;

    console.log('Created atoms mesh:', {
        count,
        hasInstanceColor: !!instancedMesh.instanceColor,
        firstColor: instancedMesh.instanceColor?.array.slice(0, 3)
    });

    return instancedMesh;
}