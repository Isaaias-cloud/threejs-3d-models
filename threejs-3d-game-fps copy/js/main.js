
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog(0x88ccee, 0, 10);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
fillLight1.position.set(2, 1, 1);
scene.add(fillLight1);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 100;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.left = - 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = - 30;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.radius = 4;
directionalLight.shadow.bias = - 0.00006;

scene.add(directionalLight);

const container = document.getElementById('container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

const stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';
container.appendChild(stats.domElement);

const GRAVITY = 30;

const STEPS_PER_FRAME = 5;

const clock = new THREE.Clock();


const worldOctree = new Octree();

const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;

const keyStates = {};

const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

const listener = new THREE.AudioListener();
camera.add(listener);

document.addEventListener('keydown', (event) => {

    keyStates[event.code] = true;

});

document.addEventListener('keyup', (event) => {

    keyStates[event.code] = false;

});

container.addEventListener('mousedown', () => {

    document.body.requestPointerLock();

    mouseTime = performance.now();

});

document.addEventListener('mouseup', () => {

});

document.body.addEventListener('mousemove', (event) => {

    if (document.pointerLockElement === document.body) {

        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;

    }

});

window.addEventListener('resize', onWindowResize);

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}


// Interacción con objeto
document.addEventListener('keydown', (event) => {
    keyStates[event.code] = true;

    if (event.code === 'KeyE' && objetoInteractivoCercano) {
        const nombre = objetoInteractivoCercano.mesh.name.toLowerCase();

        if (objetoInteractivoCercano.interactivo === false) return; // Instrumento desactivado

        if (nombre.includes("guitar")) {
            iniciarMinijuego("guitar");
        } else if (nombre.includes("drum")) {
            iniciarMinijuego("drum");
        } else if (nombre.includes("piano")) {
            iniciarMinijuego("piano");
        } else {
            iniciarMinijuego(); // Por defecto
        }
    }


});



//Clase para objetos con físicas:
class ObjetoFisico {
    constructor(mesh, opciones = {}) {
        this.mesh = mesh;
        this.velocidad = new THREE.Vector3();
        this.radio = opciones.radio ?? 0.5;
        this.usaGravedad = opciones.usaGravedad ?? false;
        this.friccion = opciones.friccion ?? 0.9;
        this.limites = opciones.limites ?? null;
        this.alturaMinima = opciones.alturaMinima ?? 0.25; // Altura mínima para evitar atravesar el suelo
    }

    actualizar(deltaTime, otrosObjetos = []) {
        if (this.usaGravedad) {
            this.velocidad.y -= GRAVITY * deltaTime;
        }

        this.mesh.position.addScaledVector(this.velocidad, deltaTime);

        if (this.mesh.position.y < this.alturaMinima) {
            this.mesh.position.y = this.alturaMinima;
            this.velocidad.y = 0;
        }

        this.velocidad.multiplyScalar(this.friccion);

        if (this.limites) {
            const pos = this.mesh.position;
            pos.x = THREE.MathUtils.clamp(pos.x, this.limites.min.x, this.limites.max.x);
            pos.z = THREE.MathUtils.clamp(pos.z, this.limites.min.z, this.limites.max.z);
        }

        for (const otro of otrosObjetos) {
            if (otro === this) continue;

            const dir = new THREE.Vector3().subVectors(this.mesh.position, otro.mesh.position);
            const dist = dir.length();
            const minDist = this.radio + otro.radio;

            if (dist < minDist) {
                dir.normalize();
                const empuje = dir.multiplyScalar((minDist - dist) / 2);

                this.mesh.position.add(empuje);
                otro.mesh.position.sub(empuje);

                const tmp = this.velocidad.clone();
                this.velocidad.copy(otro.velocidad);
                otro.velocidad.copy(tmp);
            }
        }
    }

    empujar(direccion, fuerza) {
        const empuje = direccion.clone().multiplyScalar(fuerza);
        this.velocidad.add(empuje);
    }

    resolverColisionJugador(playerCollider, playerVelocity) {
        const distancia = this.mesh.position.distanceTo(playerCollider.end);
        const radioSuma = this.radio + playerCollider.radius;

        if (distancia < radioSuma) {
            const direccion = this.mesh.position.clone().sub(playerCollider.end).normalize();
            const penetracion = radioSuma - distancia;

            this.mesh.position.add(direccion.multiplyScalar(penetracion * 0.5));

            if (this.usaGravedad) {
                this.velocidad.add(direccion.clone().multiplyScalar(playerVelocity.length() * 0.5));
            }
        }
    }
}



function playerCollisions() {

    const result = worldOctree.capsuleIntersect(playerCollider);

    playerOnFloor = false;

    if (result) {

        playerOnFloor = result.normal.y > 0;

        if (!playerOnFloor) {

            playerVelocity.addScaledVector(result.normal, - result.normal.dot(playerVelocity));

        }

        if (result.depth >= 1e-10) {

            playerCollider.translate(result.normal.multiplyScalar(result.depth));

        }

    }

}

function updatePlayer(deltaTime) {

    let damping = Math.exp(- 4 * deltaTime) - 1;

    if (!playerOnFloor) {

        playerVelocity.y -= GRAVITY * deltaTime;

        // small air resistance
        damping *= 0.1;

    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
    playerCollider.translate(deltaPosition);

    playerCollisions();

    camera.position.copy(playerCollider.end);



}


function getForwardVector() {

    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();

    return playerDirection;

}

function getSideVector() {

    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross(camera.up);

    return playerDirection;

}

function controls(deltaTime) {

    // gives a bit of air control
    const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

    if (keyStates['KeyW']) {

        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));

    }

    if (keyStates['KeyS']) {

        playerVelocity.add(getForwardVector().multiplyScalar(- speedDelta));

    }

    if (keyStates['KeyA']) {

        playerVelocity.add(getSideVector().multiplyScalar(- speedDelta));

    }

    if (keyStates['KeyD']) {

        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));

    }

    if (playerOnFloor) {

        if (keyStates['Space']) {

            playerVelocity.y = 15;

        }

    }

}

const loader = new GLTFLoader().setPath('../models/gltf/');
//Objetos
const objetosFisicos = [];
//Límites
const limitesTienda = {
    min: new THREE.Vector3(-10, 0, 0),
    max: new THREE.Vector3(10, 5, 10)
};

function agregarLuzALampara(objeto) {
    const luz = new THREE.PointLight(0xffeeaa, 1, 10); // color, intensidad, distancia
    luz.position.set(0, 1, 0); // posición relativa al objeto (ajústala si es necesario)
    objeto.add(luz); // se adjunta la luz al objeto de la lámpara

    // Opcional: Agrega un pequeño helper visual para depuración
    // const helper = new THREE.PointLightHelper(luz, 0.2);
    // scene.add(helper);
}

let gltfModel;
let guitarObject, drumObject, pianoObject; // 👈 Declara estas variables en el contexto global


loader.load('Store_.glb', (gltf) => {

    gltfModel = gltf;

    scene.add(gltf.scene);

    gltf.scene.traverse(child => {
        if (child.isMesh && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material.map) {
                child.material.map.anisotropy = 4;
            }

            const nombre = child.name.toLowerCase();

            if (nombre.includes("lamp")) {
                agregarLuzALampara(child);
            }

            if (nombre.includes("table") || nombre.includes("guardaropa") || nombre.includes("chair")
                || nombre.includes("drum") || nombre.includes("piano") || nombre.includes("guitar")
                || nombre.includes("hat")) {
                const obj = new ObjetoFisico(child, {
                    radio: 0.8,
                    usaGravedad: false,
                    limites: limitesTienda
                });

                objetosFisicos.push(obj);
            }

            // Asignar referencias a instrumentos
            if (nombre.includes("guitar")) {
                guitarObject = child;
            } else if (nombre.includes("drum")) {
                drumObject = child;
            } else if (nombre.includes("piano")) {
                pianoObject = child;
            }
        }
    });

    // ⬇️ Mueve esta línea aquí, después del traverse
    worldOctree.fromGraphNode(gltf.scene);

    for (let i = 0; i < 30; i++) {
        crearObjetoAleatorio(Math.random() > 0.5 ? 'cubo' : 'esfera');
    }

    const helper = new OctreeHelper(worldOctree);
    helper.visible = false;
    scene.add(helper);

    const gui = new GUI({ width: 200 });
    gui.add({ debug: false }, 'debug')
        .onChange(function (value) {
            helper.visible = value;
        });
});


// Crear geometría para las gotas de lluvia
const lluviaCantidad = 1000;
const lluviaGeo = new THREE.BufferGeometry();
const posiciones = [];

for (let i = 0; i < lluviaCantidad; i++) {
    const x = Math.random() * 100 - 50;  // Ajusta el área de dispersión
    const y = Math.random() * 50 + 10;   // Altura inicial
    const z = Math.random() * 100 - 50;

    posiciones.push(x, y, z);
}

lluviaGeo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));

// Material de las gotas
const lluviaMat = new THREE.PointsMaterial({
    color: 0xaaaaee,
    size: 0.1,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
});

const lluvia = new THREE.Points(lluviaGeo, lluviaMat);
scene.add(lluvia);

function teleportPlayerIfOob() {
    if (camera.position.y <= -25) {
        playerCollider.start.set(0, 0.35, 0);
        playerCollider.end.set(0, 1, 0);
        playerCollider.radius = 0.35;
        camera.position.copy(playerCollider.end);
        camera.rotation.set(0, 0, 0);

    }
}



function crearObjetoAleatorio(tipo = 'cubo') {
    let geometry, material;

    if (tipo === 'cubo') {
        geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    } else {
        geometry = new THREE.SphereGeometry(0.25, 16, 16);
        material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Posición inicial aleatoria dentro de los límites de la tienda
    mesh.position.set(
        THREE.MathUtils.randFloat(limitesTienda.min.x, limitesTienda.max.x),
        THREE.MathUtils.randFloat(2, 5),
        THREE.MathUtils.randFloat(limitesTienda.min.z, limitesTienda.max.z)
    );

    scene.add(mesh);

    const obj = new ObjetoFisico(mesh, {
        radio: tipo === 'cubo' ? 0.35 : 0.25,
        usaGravedad: true,
        limites: limitesTienda
    });

    objetosFisicos.push(obj);
}

let objetoInteractivoCercano = null;

function animate() {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

    objetoInteractivoCercano = null;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        controls(deltaTime);
        updatePlayer(deltaTime);
        teleportPlayerIfOob();

        for (let obj of objetosFisicos) {
            obj.actualizar(deltaTime);
            obj.resolverColisionJugador(playerCollider, playerVelocity);

            const nombre = obj.mesh.name.toLowerCase();
            if (nombre.includes("piano") || nombre.includes("guitar") || nombre.includes("drum")) {
                const distancia = obj.mesh.position.distanceTo(playerCollider.end);
                if (distancia < 2.5) {
                    objetoInteractivoCercano = obj;
                }
            }
        }
    }

    const prompt = document.getElementById('interactPrompt');
    prompt.style.display = objetoInteractivoCercano ? 'block' : 'none';


    const posicionesLluvia = lluvia.geometry.attributes.position.array;
    for (let i = 1; i < posicionesLluvia.length; i += 3) {
        posicionesLluvia[i] -= 0.3; // velocidad de caída

        // Reiniciar gota si cae al suelo
        if (posicionesLluvia[i] < 0) {
            posicionesLluvia[i] = Math.random() * 50 + 10;
        }
    }
    lluvia.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    stats.update();
}



function iniciarMinijuego(instrumento) {
    const contenedor = document.getElementById('minijuego-container');
    const canvas = document.getElementById('minijuego');
    const ctx = canvas.getContext('2d');

    // Crear audio posicional
    const sonido = new THREE.PositionalAudio(listener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load(`assets/${instrumento}-loop.mp3`, (buffer) => {
        sonido.setBuffer(buffer);
        sonido.setRefDistance(5);
        sonido.setLoop(true);
        sonido.play();

        // Asociar el sonido al objeto 3D correcto
        if (instrumento === 'guitar') {
            guitarObject.add(sonido);
        } else if (instrumento === 'drum') {
            drumObject.add(sonido);
        } else if (instrumento === 'piano') {
            pianoObject.add(sonido);
        }
    });


    contenedor.style.display = 'block';

    const teclasPosibles = ['p', 'o', 'i', 'u'];
    const totalTeclas = 20;
    const velocidad = 3;
    const teclas = [];

    const zonaX = canvas.width - 100;
    const zonaWidth = 80;
    let teclasPresionadas = 0;

    for (let i = 0; i < totalTeclas; i++) {
        const letra = teclasPosibles[Math.floor(Math.random() * teclasPosibles.length)];
        teclas.push({ letra, x: -i * 100, estado: 'pendiente', contador: 0 });
    }

    let animando = true;

    function dibujarZona() {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // 🔴 Cambiado a rojo
        ctx.fillRect(zonaX, 0, zonaWidth, canvas.height);
    }

    function dibujarTeclas() {
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        teclas.forEach((t) => {
            if (t.estado === 'oculta') return;

            // Color según estado
            if (t.estado === 'correcta') ctx.fillStyle = 'lime';
            else if (t.estado === 'incorrecta') ctx.fillStyle = 'red';
            else ctx.fillStyle = 'white';

            ctx.fillText(t.letra.toUpperCase(), t.x + 25, canvas.height / 2);
            t.x += velocidad;

            // Si entra a la zona roja sin haber sido presionada
            if (t.estado === 'pendiente' && t.x >= zonaX) {
                t.estado = 'incorrecta';
            }

            // Ocultar después de un tiempo
            if ((t.estado === 'correcta' || t.estado === 'incorrecta') && t.contador++ > 20) {
                t.estado = 'oculta';
            }
        });
    }

    function loop() {
        if (!animando) return;

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        dibujarZona();
        dibujarTeclas();

        const teclasVisibles = teclas.filter(t => t.estado !== 'oculta');
        if (teclasVisibles.length === 0) {
            animando = false;
            mostrarPuntuacion();
            return;
        }

        requestAnimationFrame(loop);
    }

    function mostrarPuntuacion() {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Puntuación: ${teclasPresionadas}/${totalTeclas}`, canvas.width / 2, canvas.height / 2);

        setTimeout(() => {
            //audio.pause();
            //audio.currentTime = 0;
            sonido.stop();
            contenedor.style.display = 'none';

            if (teclasPresionadas >= 11) {
                desactivarInstrumento(instrumento);
            }
        }, 3000);
    }

    window.addEventListener('keydown', (e) => {
        if (!animando) return;

        if (e.code === 'Escape') {
            animando = false;
            contenedor.style.display = 'none';
            return;
        }

        const teclaPresionada = e.key.toLowerCase();

        // Buscar la primera tecla pendiente
        const proximaTecla = teclas.find(t => t.estado === 'pendiente');
        if (!proximaTecla) return;

        // Validar si se presionó correctamente
        if (teclaPresionada === proximaTecla.letra) {
            proximaTecla.estado = 'correcta';
            teclasPresionadas++;
        } else {
            proximaTecla.estado = 'incorrecta';
        }
    });


    loop();
}


let instrumentosDesactivados = 0;
const totalInstrumentos = 3;

function desactivarInstrumento(nombreInstrumento) {
    const nombreLower = nombreInstrumento.toLowerCase();

    for (const obj of objetosFisicos) {
        const nombre = obj.mesh.name.toLowerCase();
        if (nombre.includes(nombreLower)) {
            // Desactivar interacción futura
            obj.interactivo = false;

            // Reproducir sonido en loop
            const loopAudio = new Audio(`assets/${nombreInstrumento}-loop2.mp3`);
            loopAudio.loop = true;
            loopAudio.play();

            // Adjuntar audio al mesh (no físico, solo simbólico)
            obj.mesh.userData.audioLoop = loopAudio;

            // Cambiar color o aspecto visual si quieres indicar que está "activo"
            obj.mesh.material.color.set(0x00ff00);

            instrumentosDesactivados++;

            if (instrumentosDesactivados === totalInstrumentos) {
                desactivarPuerta(gltfModel); // Asegúrate de tener gltfModel disponible
            }

            break;
        }
    }
}

function desactivarPuerta(gltf) {
    const puerta = gltf.scene.getObjectByName("Cube006");

    if (puerta) {
        // Opción 1: Ocultarla visualmente
        puerta.visible = false;

        // Opción 2 (alternativa): Eliminarla de la escena si quieres que no tenga colisiones ni interacciones
        puerta.parent.remove(puerta);

        mostrarMensajeEscape();
    } else {
        console.warn("No se encontró la puerta (Cube.006) en la escena");
    }
}

function mostrarMensajeEscape() {
    const mensajeDiv = document.createElement("div");
    mensajeDiv.style.position = "fixed";
    mensajeDiv.style.top = "50%";
    mensajeDiv.style.left = "50%";
    mensajeDiv.style.transform = "translate(-50%, -50%)";
    mensajeDiv.style.padding = "20px";
    mensajeDiv.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    mensajeDiv.style.color = "#fff";
    mensajeDiv.style.fontSize = "24px";
    mensajeDiv.style.zIndex = "1000";
    mensajeDiv.style.borderRadius = "10px";
    mensajeDiv.innerText = "Has escapado";

    document.body.appendChild(mensajeDiv);

    setTimeout(() => {
        mensajeDiv.innerText = "Presiona la tecla R para reiniciar";
        window.addEventListener("keydown", reiniciarPagina);
    }, 3000);
}

function reiniciarPagina(e) {
    if (e.key.toLowerCase() === "r") {
        window.removeEventListener("keydown", reiniciarPagina);
        window.location.reload();
    }
}

