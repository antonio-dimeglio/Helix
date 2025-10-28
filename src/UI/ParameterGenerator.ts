import { Parameter, ParameterType } from "../Renderer/Color/Parameter";

function generateRange(param: Parameter) : HTMLElement {
    const ctrlGroup = document.createElement('div');
    ctrlGroup.className = 'control-group';

    // Label with value display
    const rangeLabel = document.createElement('div');
    rangeLabel.className = 'range-label';

    const label = document.createElement('span');
    label.className = 'control-label';
    label.textContent = param.label;
    label.style.margin = '0';

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'range-value';
    valueDisplay.id = `${param.name}-value`;
    valueDisplay.textContent = param.defaultValue.toString();

    rangeLabel.appendChild(label);
    rangeLabel.appendChild(valueDisplay);
    ctrlGroup.appendChild(rangeLabel);

    // Slider input
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.setAttribute('data-param', param.name);
    slider.value = param.defaultValue.toString();
    slider.min = param.min?.toString() || '0';
    slider.max = param.max?.toString() || '100';
    slider.step = param.step?.toString() || '1';

    // Update value display when slider changes
    slider.addEventListener('input', (e) => {
        valueDisplay.textContent = (e.target as HTMLInputElement).value;
    });

    ctrlGroup.appendChild(slider);

    return ctrlGroup;

}

function generateSelect(param: Parameter) : HTMLElement {
    const ctrlGroup = document.createElement('div');
    ctrlGroup.className = 'control-group';

    const lbl = document.createElement('label');
    lbl.className = 'control-label';
    lbl.textContent = param.label;
    ctrlGroup.appendChild(lbl);

    const select = document.createElement('select');
    select.setAttribute('data-param', param.name);
    ctrlGroup.appendChild(select);

    if (!param.options) {
        return ctrlGroup;
    }   

    for (const opt of param.options) {
        const optHtml = document.createElement('option');
        optHtml.value = opt;
        optHtml.textContent = opt;
        select.appendChild(optHtml);

        if (opt === param.defaultValue) {
            optHtml.selected = true;   
        }
    }

    return ctrlGroup;
}

function generateCheckBox(param: Parameter): HTMLElement {
    const checkboxGroup = document.createElement('div');
    checkboxGroup.className = 'checkbox-group';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `param-${param.name}`;
    checkbox.setAttribute('data-param', param.name);
    checkbox.checked = param.defaultValue === true;

    const label = document.createElement('label');
    label.htmlFor = `param-${param.name}`;
    label.textContent = param.label;

    checkboxGroup.appendChild(checkbox);
    checkboxGroup.appendChild(label);

    return checkboxGroup;
}

function generateNumber(param: Parameter): HTMLElement {
    const ctrlGroup = document.createElement('div');
    ctrlGroup.className = 'control-group';

    const label = document.createElement('label');
    label.className = 'control-label';
    label.textContent = param.label;
    ctrlGroup.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.setAttribute('data-param', param.name);
    input.value = param.defaultValue.toString();

    if (param.min !== undefined) input.min = param.min.toString();
    if (param.max !== undefined) input.max = param.max.toString();
    if (param.step !== undefined) input.step = param.step.toString();

    ctrlGroup.appendChild(input);

    return ctrlGroup;
}


function generateColor(param: Parameter): HTMLElement {
    const ctrlGroup = document.createElement('div');
    ctrlGroup.className = 'control-group';

    const label = document.createElement('label');
    label.className = 'control-label';
    label.textContent = param.label;
    ctrlGroup.appendChild(label);

    const pickerGroup = document.createElement('div');
    pickerGroup.className = 'color-picker-group';

    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = param.defaultValue;

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.setAttribute('data-param', param.name);
    colorInput.value = param.defaultValue;

    // Update swatch and text input in real-time as user drags
    colorInput.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        swatch.style.background = value;
        textInput.value = value;
    });

    // Also listen to change event for final value
    colorInput.addEventListener('change', (e) => {
        const value = (e.target as HTMLInputElement).value;
        swatch.style.background = value;
        textInput.value = value;
    });

    swatch.appendChild(colorInput);
    pickerGroup.appendChild(swatch);

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = param.defaultValue;
    textInput.style.flex = '1';

    textInput.addEventListener('change', (e) => {
        const value = (e.target as HTMLInputElement).value;
        colorInput.value = value;
        swatch.style.background = value;
        // Trigger the color input's change event so ColorUIController picks it up
        colorInput.dispatchEvent(new Event('change'));
    });

    pickerGroup.appendChild(textInput);
    ctrlGroup.appendChild(pickerGroup);

    return ctrlGroup;

}


export function generateParameters(params: Parameter[]) : HTMLElement[] {
    const paramsArray: HTMLElement[] = []

    params.forEach((param) => {
        switch (param.type) {
            case 'range':
                paramsArray.push(generateRange(param));
                break;
            case 'select':
                paramsArray.push(generateSelect(param));
                break;
            case 'checkbox':
                paramsArray.push(generateCheckBox(param));
                break;
            case 'color':
                paramsArray.push(generateColor(param));
                break;
            case 'number':
                paramsArray.push(generateNumber(param));
                break;
        }
    });

    return paramsArray;
}

