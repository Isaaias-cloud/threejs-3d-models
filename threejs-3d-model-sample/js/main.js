import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;

renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);

renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,1,1000);
camera.position.set(4,5,11);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping= true;
controls.enablePan=false;
controls.minDistance=5;
controls.maxDistance=20;
controls.minPolarAngle=0.5;
controls.maxPolarAngle=1.5;
controls.autoRotate=false;
controls.target=new THREE.Vector3(0,1,0);
controls.update();

const groundGeometry=new THREE.PlaneGeometry(20,20,32,32);
groundGeometry.rotateX(-Math.PI/2);
const groundMaterial=new THREE.MeshStandardMaterial({color:0x555555, side: THREE.DoubleSide});
const groundMesh=new THREE.Mesh(groundGeometry,groundMaterial);
groundMesh.castShadow=false;
groundMesh.receiveShadow=true;
scene.add(groundMesh);

const spotLight=new THREE.SpotLight(0xffffff,3,100,0.2,0.5);
spotLight.position.set(0,25,0);
spotLight.castShadow=true;
spotLight.shadow.bias=-0.0001;
scene.add(spotLight);

//Ajuste para visualizar el elemento 3d correctamente
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const loader=new GLTFLoader().setPath('../models/millennium_falcon/');
loader.load('scene.gltf', (gltf) => {
    const mesh=gltf.scene;
    
    mesh.traverse((child)=> {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    mesh.position.set(0,1.05,-1);
    scene.add(mesh);
})

function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene,camera);
}

animate();
