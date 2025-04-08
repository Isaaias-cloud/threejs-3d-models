import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const manager = new THREE.LoadingManager();
let camera, scene, renderer, stats, object, loader;
let mixer, currentAction;
const clock = new THREE.Clock();

const animations = [
  'Breakdance 1990',
  'Fall Flat',
  'Jump Push Up',
  'Taunt',
  'Reaction'
];

let actions = {};
let currentIndex = 0;

init();

function init() {
  const container = document.getElementById('three-container');

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.set(100, 200, 300);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0a0a0);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 5);
  dirLight.position.set(0, 200, 100);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  scene.add(grid);

  loader = new FBXLoader(manager);
  loadModelWithAllAnimations();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 100, 0);
  controls.update();

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', handleKeyInput);

  stats = new Stats();
  container.appendChild(stats.dom);
}

function loadModelWithAllAnimations() {
  loader.load(`../models/fbx/${animations[0]}.fbx`, (model) => {
    object = model;
    object.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    mixer = new THREE.AnimationMixer(object);
    scene.add(object);

    // Cargar las animaciones restantes
    loadAllAnimations();
  });
}

function loadAllAnimations() {
  let loadedCount = 0;

  animations.forEach(name => {
    loader.load(`../models/fbx/${name}.fbx`, anim => {
      const clip = anim.animations[0];
      actions[name] = mixer.clipAction(clip);
      loadedCount++;

      if (loadedCount === animations.length) {
        playAnimation(animations[currentIndex]);
      }
    });
  });
}

function playAnimation(name) {
  const nextAction = actions[name];
  if (!nextAction) return;

  nextAction.reset();
  nextAction.fadeIn(0.5).play();

  if (currentAction && currentAction !== nextAction) {
    currentAction.fadeOut(0.5);
  }

  currentAction = nextAction;
}

function handleKeyInput(event) {
  const key = event.key;
  if (['1', '2', '3', '4', '5'].includes(key)) {
    currentIndex = parseInt(key) - 1;
    playAnimation(animations[currentIndex]);
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
  stats.update();
}

animate();
