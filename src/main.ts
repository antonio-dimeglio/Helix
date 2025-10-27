import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ProteinRenderer } from './Renderer/ProteinRenderer';
import { UIController } from './UI/UIController';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000  // Increased from 1000 to 10000 for large complexes
);
camera.position.z = 5;

const canvasArea = document.getElementById('canvasArea')!;
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'  // Use dedicated GPU if available
});

// Size renderer to fit the canvas area, not the full window
function updateRendererSize() {
    const width = canvasArea.clientWidth;
    const height = canvasArea.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

updateRendererSize();
renderer.setPixelRatio(window.devicePixelRatio);
canvasArea.appendChild(renderer.domElement);

renderer.domElement.addEventListener('dragstart', (e) => e.preventDefault());
renderer.domElement.style.touchAction = 'none';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 5000;  // Increased from 100 to 5000 for large complexes

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

let lastTime = performance.now();
let frameCount = 0;
let fpsTime = 0;

const proteinRenderer = new ProteinRenderer(scene);
const controller = new UIController(proteinRenderer, renderer, scene, camera, controls);

function animate(currentTime: number) {
    requestAnimationFrame(animate);

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    frameCount++;
    fpsTime += deltaTime;
    if (fpsTime >= 1.0) {
        controller.updateFPS(frameCount);
        frameCount = 0;
        fpsTime = 0;
    }

    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', updateRendererSize);

animate(performance.now());

