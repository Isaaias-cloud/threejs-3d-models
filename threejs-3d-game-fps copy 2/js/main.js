
import * as THREE from 'three';
//import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Capsule } from 'three/addons/math/Capsule.js';
//import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccee);
scene.fog = new THREE.Fog(0x88ccee, 0, 10);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
//camera.rotation.order = 'YXZ';

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
renderer.xr.enabled = true; // <-- Activar VR
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

// Agrega el botón VR
document.body.appendChild(VRButton.createButton(renderer));

//const stats = new Stats();
//stats.domElement.style.position = 'absolute';
//stats.domElement.style.top = '0px';
//container.appendChild(stats.domElement);

const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const clock = new THREE.Clock();


const worldOctree = new Octree();
const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = false;
const keyStates = {};

const listener = new THREE.AudioListener();
camera.add(listener);



window.addEventListener('resize', onWindowResize);

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

// Interacción con objeto




//Clase para objetos con físicas:
class ObjetoFisico {
    constructor(mesh, opciones = {}) {
        this.mesh = mesh;
        this.velocidad = new THREE.Vector3();
        this.radio = opciones.radio ?? 0.5;
        this.usaGravedad = opciones.usaGravedad ?? false;
        this.friccion = opciones.friccion ?? 0.9;
        //this.limites = opciones.limites ?? null;
        this.alturaMinima = opciones.alturaMinima ?? 0.5; // Altura mínima para evitar atravesar el suelo
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


        for (const otro of otrosObjetos) {
            if (otro === this) continue;

            const esParedOPiso = otro.esPared || otro.esPiso;
            if (!esParedOPiso) continue;

            const dir = new THREE.Vector3().subVectors(this.mesh.position, otro.mesh.position);
            const dist = dir.length();
            const minDist = this.radio + otro.radio;

            if (dist < minDist) {
                dir.normalize();
                const empuje = dir.multiplyScalar(minDist - dist);

                this.mesh.position.add(empuje);

                // Si el otro es piso, y estamos yendo hacia abajo, detén la caída
                if (otro.esPiso && this.velocidad.y < 0) {
                    this.velocidad.y = 0;
                }
            }
        }

        // if (this.limites) {
        //     const pos = this.mesh.position;
        //     pos.x = THREE.MathUtils.clamp(pos.x, this.limites.min.x, this.limites.max.x);
        //     pos.z = THREE.MathUtils.clamp(pos.z, this.limites.min.z, this.limites.max.z);
        // }

        for (const otro of otrosObjetos) {
            if (otro === this) continue;

            const dir = new THREE.Vector3().subVectors(this.mesh.position, otro.mesh.position);
            const dist = dir.length();
            const minDist = this.radio + otro.radio;

            if (dist < minDist) {
                dir.normalize();
                const empuje = dir.multiplyScalar((minDist - dist) / 2);

                if (!otro.esPared) {
                    otro.mesh.position.sub(empuje);
                }

                this.mesh.position.add(empuje);


                const tmp = this.velocidad.clone();
                this.velocidad.copy(otro.velocidad);
                otro.velocidad.copy(tmp);
            }
        }
        this.mesh.updateMatrixWorld(true);

    }

    empujar(direccion, fuerza) {
        const empuje = direccion.clone().multiplyScalar(fuerza);
        this.velocidad.add(empuje);
    }

    resolverColisionJugador(playerCollider, playerVelocity, otrosObjetos = []) {
        const distancia = this.mesh.position.distanceTo(playerCollider.end);
        const radioSuma = this.radio + playerCollider.radius;

        if (distancia < radioSuma) {
            const direccion = this.mesh.position.clone().sub(playerCollider.end).normalize();
            const penetracion = radioSuma - distancia;

            // Solo aplica empuje a objetos que NO son paredes
            if (!this.esPared) {
                this.mesh.position.add(direccion.multiplyScalar(penetracion * 0.5));

                if (this.usaGravedad) {
                    this.velocidad.add(direccion.clone().multiplyScalar(playerVelocity.length() * 0.5));
                }

                // Verificar colisión contra paredes y piso
                for (const otro of otrosObjetos) {
                    if (otro === this) continue;

                    const esParedOPiso = otro.esPared || otro.esPiso;
                    if (!esParedOPiso) continue;

                    const dir = new THREE.Vector3().subVectors(this.mesh.position, otro.mesh.position);
                    const dist = dir.length();
                    const minDist = this.radio + otro.radio;

                    if (dist < minDist) {
                        dir.normalize();
                        const empuje = dir.multiplyScalar(minDist - dist);

                        // Reposicionar el objeto empujado
                        this.mesh.position.add(empuje);

                        // Si es el piso, detener la velocidad vertical
                        if (otro.esPiso && this.velocidad.y < 0) {
                            this.velocidad.y = 0;
                        }
                    }
                }
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
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // evitar moverse verticalmente
    direction.normalize();
    return direction;
}

function getSideVector() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    direction.cross(camera.up);
    return direction;
}

let botonAPresionado = false;

function detectarBotonA() {
    const session = renderer.xr.getSession();
    if (!session) return;

    for (const source of session.inputSources) {
        if (source.handedness === 'right' && source.gamepad && source.gamepad.buttons.length > 0) {
            const botonA = source.gamepad.buttons[0];

            if (botonA.pressed && !botonAPresionado) {
                botonAPresionado = true;

                if (objetoInteractivoCercano) {
                    const nombre = objetoInteractivoCercano.mesh.name.toLowerCase();

                    if (objetoInteractivoCercano.interactivo === false) return;

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

            } else if (!botonA.pressed) {
                botonAPresionado = false;
            }
        }
    }
}


function controls(deltaTime) {
    const speedDelta = deltaTime * (playerOnFloor ? 10 : 4);

    const session = renderer.xr.getSession();
    if (!session) return;

    for (const source of session.inputSources) {
        if (source.handedness === 'left' && source.gamepad) {
            const axes = source.gamepad.axes;

            // axes[2] = x (izquierda-derecha), axes[3] = y (adelante-atrás)
            const xAxis = axes[2] || 0;
            const yAxis = axes[3] || 0;

            if (Math.abs(xAxis) > 0.1) {
                const sideVector = getSideVector();
                playerVelocity.add(sideVector.multiplyScalar(speedDelta * xAxis));
            }

            if (Math.abs(yAxis) > 0.1) {
                const forwardVector = getForwardVector();
                playerVelocity.add(forwardVector.multiplyScalar(-speedDelta * yAxis));
            }
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


loader.load('Store_02.glb', (gltf) => {

    gltfModel = gltf;

    scene.add(gltf.scene);

    // Almacenar los objetos que deben ser extraídos
    // Almacenar los objetos que deben ser extraídos
    const objetosDinamicos = [];

    gltf.scene.traverse(child => {
        if (child.isMesh && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
            child.castShadow = true;
            child.receiveShadow = true;

            const geometry = child.geometry;
            const name = child.name || 'Unnamed';
            //console.log(`Mesh: ${name}, Vertices: ${geometry.attributes.position.count}`);

            if (child.material.map) {
                child.material.map.anisotropy = 4;
            }

            const nombre = child.name.toLowerCase();

            if (nombre.includes("lamp")) {
                agregarLuzALampara(child);
            }

            // Guardar objetos que serán movidos al final
            if (nombre.includes("table") || nombre.includes("guardaropa") || nombre.includes("chair") ||
                nombre.includes("drum") || nombre.includes("piano") || nombre.includes("guitar") ||
                nombre.includes("hat")) {
                objetosDinamicos.push(child);
            }

            // Piso
            if (nombre.includes("floor")) {
                //console.log("Piso detectado:", nombre);
                const piso = new ObjetoFisico(child, {
                    usaGravedad: false,
                    friccion: 1,
                    radio: 100
                });
                piso.esPiso = true;
                objetosFisicos.push(piso);
            }

            // Paredes
            if (nombre.includes("wall")) {
                //console.log("Pared detectada:", nombre);
                const pared = new ObjetoFisico(child, {
                    usaGravedad: false,
                    friccion: 1,
                    radio: 1
                });
                pared.esPared = true;
                objetosFisicos.push(pared);
            }

            // Referencias a instrumentos
            if (nombre.includes("guitar")) {
                guitarObject = child;
            } else if (nombre.includes("drum")) {
                drumObject = child;
            } else if (nombre.includes("piano")) {
                pianoObject = child;
            }
        }
    });

    // ⬇️ Ya terminó el traverse, ahora movemos los dinámicos
    objetosDinamicos.forEach(child => {
        scene.attach(child);
        const obj = new ObjetoFisico(child, {
            radio: 0.8,
            usaGravedad: false,
        });
        objetosFisicos.push(obj);
    });

    // ⬇️ Mueve esta línea aquí, después del traverse
    gltf.scene.updateMatrixWorld(true);

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
        //limites: limitesTienda
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
            obj.actualizar(deltaTime,);
            obj.resolverColisionJugador(playerCollider, playerVelocity, objetosFisicos);

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
    if (objetoInteractivoCercano) {
        const nombre = objetoInteractivoCercano.mesh.name.toLowerCase();
        if (nombre.includes("guitar") || nombre.includes("piano") || nombre.includes("drum")) {
            prompt.innerText = 'Pulsa A para tocar';
            prompt.style.display = 'block';
        }
    } else {
        prompt.style.display = 'none';
    }


    const posicionesLluvia = lluvia.geometry.attributes.position.array;
    for (let i = 1; i < posicionesLluvia.length; i += 3) {
        posicionesLluvia[i] -= 0.3; // velocidad de caída

        // Reiniciar gota si cae al suelo
        if (posicionesLluvia[i] < 0) {
            posicionesLluvia[i] = Math.random() * 50 + 10;
        }
    }
    lluvia.geometry.attributes.position.needsUpdate = true;


    detectarBotonA(); // 👈 AÑADIDO AQUÍ

    renderer.render(scene, camera);
    stats.update();
}



function iniciarMinijuego(instrumento) {
    const instrumentoMap = {
        guitar: guitarObject,
        drum: drumObject,
        piano: pianoObject
    };

    const objetoInstrumento = instrumentoMap[instrumento];
    if (!objetoInstrumento) return;

    // Crear audio posicional
    const sonido = new THREE.PositionalAudio(listener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load(`assets/${instrumento}-loop.mp3`, (buffer) => {
        sonido.setBuffer(buffer);
        sonido.setRefDistance(5);
        sonido.setLoop(true);
        sonido.play();
        objetoInstrumento.add(sonido);
    });

    // Mini lógica: tocar 5 veces con botón A para completar
    let interacciones = 0;
    const meta = 5;

    const prompt = document.getElementById('interactPrompt');
    prompt.innerText = `Toca el ${instrumento.toUpperCase()} (${interacciones}/${meta})`;

    const intervalo = setInterval(() => {
        // Cuando se alcance la meta, finalizar
        if (interacciones >= meta) {
            sonido.stop();
            clearInterval(intervalo);
            prompt.innerText = '';
            desactivarInstrumento(instrumento);
        }
    }, 500);

    // Escucha botón A para contar interacciones
    const session = renderer.xr.getSession();
    if (!session) return;

    function contarInteraccion() {
        interacciones++;
        prompt.innerText = `Toca el ${instrumento.toUpperCase()} (${interacciones}/${meta})`;
    }

    function loopBotonA() {
        for (const source of session.inputSources) {
            if (source.handedness === 'right' && source.gamepad) {
                const botonA = source.gamepad.buttons[0];
                if (botonA.pressed && !botonAPresionado) {
                    botonAPresionado = true;
                    contarInteraccion();
                } else if (!botonA.pressed) {
                    botonAPresionado = false;
                }
            }
        }

        if (interacciones < meta) {
            requestAnimationFrame(loopBotonA);
        }
    }

    loopBotonA();
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
    const puerta = gltf.scene.getObjectByName("door");


    if (puerta) {
        // Opción 1: Ocultarla visualmente
        puerta.visible = false;

        // Opción 2 (alternativa): Eliminarla de la escena si quieres que no tenga colisiones ni interacciones
        puerta.parent.remove(puerta);

        mostrarMensajeEscape();
    } else {
        console.warn("No se encontró la puerta (door) en la escena");
    }
}

function reiniciarPagina(e) {
    console.log(e.key); // Verificar si la tecla "r" está siendo detectada

    if (e.key.toLowerCase() === "r") {
        //window.removeEventListener("keydown", reiniciarPagina);
        window.location.reload();
    }
}

function mostrarMensajeEscape() {
    if (document.getElementById("mensaje-escape")) return;

    const mensajeDiv = document.createElement("div");
    mensajeDiv.id = "mensaje-escape";
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




