import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const app = document.getElementById("app");

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 10);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

// Post-processing with selective bloom
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.5, 0.8);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// First-person controls
const controls = new PointerLockControls(camera, renderer.domElement);

// Click hint
const hint = document.createElement("div");
hint.innerHTML = "Click to enter first-person view<br><small>ESC exit · WASD move · Space ascend · Shift descend</small>";
Object.assign(hint.style, {
  position: "fixed", top: "50%", left: "50%",
  transform: "translate(-50%, -50%)",
  color: "white", background: "rgba(0,0,0,0.6)",
  padding: "16px 24px", borderRadius: "10px",
  textAlign: "center", fontSize: "16px",
  pointerEvents: "none", zIndex: "10",
});
document.body.appendChild(hint);

renderer.domElement.addEventListener("click", () => controls.lock());
controls.addEventListener("lock", () => hint.style.display = "none");
controls.addEventListener("unlock", () => hint.style.display = "block");

// Keyboard input
const keys = {};
window.addEventListener("keydown", (e) => keys[e.code] = true);
window.addEventListener("keyup", (e) => keys[e.code] = false);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
fillLight.position.set(-5, 2, -5);
scene.add(fillLight);

// Load GLB
const loader = new GLTFLoader();
loader.load(
  "./LetterGameAsset.glb",
  (gltf) => {
    const model = gltf.scene;
    model.traverse((node) => {
      if (node.isMesh && node.material) {
        if (node.material.map && node.material.map.format === THREE.RGBAFormat) {
          node.material.transparent = true;
          node.material.alphaTest = 0.1;
        }
        // Selective bloom: only apply to 3D weapon models, not flat image planes
        const isFlatPlane = node.name.toLowerCase().includes('plane') || 
                           (node.geometry.attributes.position && node.geometry.attributes.position.count === 4);
        
        if (!isFlatPlane && (node.material.emissiveMap || (node.material.emissive && node.material.emissive.getHex() !== 0x000000))) {
          node.material.emissiveIntensity = Math.max(node.material.emissiveIntensity || 0, 2.0);
        } else if (isFlatPlane) {
          node.material.emissiveIntensity = 0;
        }
      }
    });
    scene.add(model);

    // Automatically position camera to fit the scene
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxAxis = Math.max(size.x, size.y, size.z);
    camera.position.set(center.x, center.y + size.y * 0.3, center.z + maxAxis * 1.5);
    camera.lookAt(center);
    console.log("Scene loaded successfully, size:", size);
  },
  undefined,
(err) => console.error("Loading failed:", err)
);

// Movement speed
const speed = 0.08;
const direction = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  if (controls.isLocked) {
    direction.set(0, 0, 0);
    if (keys["KeyW"] || keys["ArrowUp"])    direction.z -= 1;
    if (keys["KeyS"] || keys["ArrowDown"])  direction.z += 1;
    if (keys["KeyA"] || keys["ArrowLeft"])  direction.x -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) direction.x += 1;
    if (keys["Space"])      direction.y += 1;
    if (keys["ShiftLeft"])  direction.y -= 1;

    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(speed);
      controls.moveRight(direction.x);
      controls.moveForward(-direction.z);
      camera.position.y += direction.y * speed;
    }
  }

  composer.render();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
});

animate();