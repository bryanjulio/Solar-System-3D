// Importações necessárias
import * as THREE from 'three';
import * as dat from 'dat.gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { MeshStandardMaterial, TextureLoader } from 'three';

// Importação de texturas
import bgTexture1 from '/images/1.jpg';
import bgTexture2 from '/images/2.jpg';
import bgTexture3 from '/images/3.jpg';
import bgTexture4 from '/images/4.jpg';
import sunTexture from '/images/sun.jpg';
import earthTexture from '/images/earth_daymap.jpg';
import earthNightTexture from '/images/earth_nightmap.jpg';
import earthAtmosphere from '/images/earth_atmosphere.jpg';

// ****** FUNÇÃO PRINCIPAL ASSÍNCRONA ******
async function init() {
  // **1. Capturar o sy_id da URL**
  const urlParams = new URLSearchParams(window.location.search);
  const sy_id = parseFloat(urlParams.get('sy_id'));

  if (isNaN(sy_id)) {
    alert('sy_id inválido ou não fornecido na URL.');
    return;
  }

  // **2. Buscar os dados do JSON**
  let planetDataExo;
  try {
    const response = await fetch('../data/exoplanetas_dados.json');
    if (!response.ok) {
      throw new Error(`Erro ao buscar o JSON: ${response.statusText}`);
    }
    const data = await response.json();
    planetDataExo = data.find(planet => planet.sy_id === sy_id);
    if (!planetDataExo) {
      throw new Error(`Nenhum planeta encontrado com sy_id: ${sy_id}`);
    }
  } catch (error) {
    console.error(error);
    alert(`Erro ao carregar os dados do planeta: ${error.message}`);
    return;
  }

  // **3. Configurar variáveis com os dados do JSON**
  const {
    pl_name,
    st_teff,
    st_lum,
    st_rad,
    pl_rade,
    pl_orbsmax,
    sy_dist,
    Ai,
    Ae
  } = planetDataExo;

  // **4. Configuração Inicial do Three.js**
  console.log("Create the scene");
  const scene = new THREE.Scene();

  console.log("Create a perspective projection camera");
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(-175, 115, 5);

  console.log("Create the renderer");
  const renderer = new THREE.WebGL1Renderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  console.log("Create an orbit control");
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.75;
  controls.screenSpacePanning = false;

  console.log("Set up texture loader");
  const cubeTextureLoader = new THREE.CubeTextureLoader();
  const loadTexture = new TextureLoader();

  // ****** POSTPROCESSING setup ******
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // ****** OUTLINE PASS ******
  const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
  outlinePass.edgeStrength = 3;
  outlinePass.edgeGlow = 1;
  outlinePass.visibleEdgeColor.set(0xffffff);
  outlinePass.hiddenEdgeColor.set(0x190a05);
  composer.addPass(outlinePass);

  // ****** BLOOM PASS ******
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.4, 0.85);
  bloomPass.threshold = 1;
  bloomPass.radius = 0.9;
  composer.addPass(bloomPass);

  // ****** AMBIENT LIGHT ******
  console.log("Add the ambient light");
  const lightAmbient = new THREE.AmbientLight(0x222222, 6);
  scene.add(lightAmbient);

  // ****** STAR BACKGROUND ******
  scene.background = cubeTextureLoader.load([
    bgTexture3,
    bgTexture1,
    bgTexture2,
    bgTexture2,
    bgTexture4,
    bgTexture2
  ]);

  // ****** GUI CONTROLS ******
  const gui = new dat.GUI({ autoPlace: false });
  const customContainer = document.getElementById('gui-container');
  if (customContainer) {
    customContainer.appendChild(gui.domElement);
  } else {
    console.warn('Elemento com id "gui-container" não encontrado. GUI não será adicionada.');
  }

  // ****** SETTINGS FOR INTERACTIVE CONTROLS ******
  const settings = {
    accelerationOrbit: 1,
    acceleration: 1,
    sunIntensity: 1.9
  };

  gui.add(settings, 'accelerationOrbit', 0, 10).onChange(value => {
    // Você pode adicionar lógica aqui se necessário
  });
  gui.add(settings, 'acceleration', 0, 10).onChange(value => {
    // Você pode adicionar lógica aqui se necessário
  });
  gui.add(settings, 'sunIntensity', 1, 10).onChange(value => {
    if (sunMat) {
      sunMat.emissiveIntensity = value;
    }
  });

  // ****** MOUSE MOVEMENT ******
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onMouseMove(event) {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  }

  // ****** SELECT PLANET ******
  let selectedPlanet = null;
  let isMovingTowardsPlanet = false;
  let targetCameraPosition = new THREE.Vector3();
  let offset;

  function onDocumentMouseDown(event) {
    event.preventDefault();

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(raycastTargets);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      selectedPlanet = identifyPlanet(clickedObject);
      if (selectedPlanet) {
        closeInfoNoZoomOut();

        settings.accelerationOrbit = 0; // Stop orbital movement

        // Update camera to look at the selected planet
        const planetPosition = new THREE.Vector3();
        selectedPlanet.planet.getWorldPosition(planetPosition);
        controls.target.copy(planetPosition);
        camera.lookAt(planetPosition); // Orient the camera towards the planet

        targetCameraPosition.copy(planetPosition).add(camera.position.clone().sub(planetPosition).normalize().multiplyScalar(offset));
        isMovingTowardsPlanet = true;
      }
    }
  }

  function identifyPlanet(clickedObject) {
    // Logic to identify which planet was clicked based on the clicked object
    if (clickedObject.material === earth.Atmosphere.material) {
      offset = 25;
      return earth;
    }
    return null;
  }

  // ****** SHOW PLANET INFO AFTER SELECTION ******
  function showPlanetInfo(planetName) {
    const info = document.getElementById('planetInfo');
    const name = document.getElementById('planetName');
    const details = document.getElementById('planetDetails');

    if (info && name && details) {
      name.innerText = planetName;
      const planetDetails = planetData[planetName];
      details.innerText = `Radius: ${planetDetails.radius}\nDistance: ${planetDetails.distance}`;
      info.style.display = 'block';
    } else {
      console.warn('Elementos de info do planeta não encontrados no DOM.');
    }
  }

  let isZoomingOut = false;
  const zoomOutTargetPosition = new THREE.Vector3(-175, 115, 5);

  // ****** CLOSE INFO FUNCTION ******
  function closeInfo() {
    const info = document.getElementById('planetInfo');
    if (info) {
      info.style.display = 'none';
    }
    settings.accelerationOrbit = 1;
    isZoomingOut = true;
    controls.target.set(0, 0, 0);
  }
  window.closeInfo = closeInfo;

  // ****** CLOSE INFO WITHOUT ZOOM OUT ******
  function closeInfoNoZoomOut() {
    const info = document.getElementById('planetInfo');
    if (info) {
      info.style.display = 'none';
    }
    settings.accelerationOrbit = 1;
  }

  // ****** SUN CONFIGURATION ******
  const temperatureToColor = (temperature) => {
    if (temperature >= 30000) {
      return '#9BB0FF'; // Blue (Hot star)
    } else if (temperature >= 6000) {
      return '#FFFFFF'; // White (Main sequence star like our sun)
    } else if (temperature >= 5000) {
      return '#FFCC6F'; // Yellow (Cooler star)
    } else {
      return '#FF6666'; // Red (Cool star, often giants or dwarfs)
    }
  };

  const stairColor = temperatureToColor(st_teff);

  // Calcula a luminosidade da estrela
  const luminosityRelative = Math.pow(10, st_lum);
  const absoluteLuminosity = luminosityRelative * solarLuminosity;
  console.log(absoluteLuminosity);

  let sunMat;

  const sunSize = 697 / 40; // 40 times smaller scale than earth
  const starSize = st_rad * sunSize;
  const sunGeom = new THREE.SphereGeometry(starSize, 32, 20);
  sunMat = new THREE.MeshStandardMaterial({
    emissive: stairColor,
    emissiveMap: loadTexture.load(sunTexture),
    emissiveIntensity: settings.sunIntensity
  });
  const sun = new THREE.Mesh(sunGeom, sunMat);
  scene.add(sun);

  // Point light in the sun
  const pointLight = new THREE.PointLight(0xFDFFD3, 1200, 400, 1.4);
  scene.add(pointLight);

  // ****** PLANET CREATION FUNCTION ******
  function createPlanet(planetName, size, position, tilt, texture, bump, ring, atmosphere) {
    let material;
    if (texture instanceof THREE.Material) {
      material = texture;
    } else if (bump) {
      material = new THREE.MeshPhongMaterial({
        map: loadTexture.load(texture),
        bumpMap: loadTexture.load(bump),
        bumpScale: 0.7
      });
    } else {
      material = new THREE.MeshPhongMaterial({
        map: loadTexture.load(texture)
      });
    }

    const geometry = new THREE.SphereGeometry(size, 32, 20);
    const planet = new THREE.Mesh(geometry, material);
    const planet3d = new THREE.Object3D();
    const planetSystem = new THREE.Group();
    planetSystem.add(planet);
    let Atmosphere;
    let Ring;
    planet.position.x = position;
    planet.rotation.z = tilt * Math.PI / 180;

    // Add orbit path
    const orbitPath = new THREE.EllipseCurve(
      0, 0, // ax, aY
      position, position, // xRadius, yRadius
      0, 2 * Math.PI, // aStartAngle, aEndAngle
      false, // aClockwise
      0 // aRotation
    );

    const pathPoints = orbitPath.getPoints(100);
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.03 });
    const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
    orbit.rotation.x = Math.PI / 2;
    planetSystem.add(orbit);

    // Add ring
    if (ring) {
      const RingGeo = new THREE.RingGeometry(ring.innerRadius, ring.outerRadius, 30);
      const RingMat = new THREE.MeshStandardMaterial({
        map: loadTexture.load(ring.texture),
        side: THREE.DoubleSide
      });
      Ring = new THREE.Mesh(RingGeo, RingMat);
      planetSystem.add(Ring);
      Ring.position.x = position;
      Ring.rotation.x = -0.5 * Math.PI;
      Ring.rotation.y = -tilt * Math.PI / 180;
    }

    // Add atmosphere
    if (atmosphere) {
      const atmosphereGeom = new THREE.SphereGeometry(size + 0.1, 32, 20);
      const atmosphereMaterial = new THREE.MeshPhongMaterial({
        map: loadTexture.load(atmosphere),
        transparent: true,
        opacity: 0.4,
        depthTest: true,
        depthWrite: false
      });
      Atmosphere = new THREE.Mesh(atmosphereGeom, atmosphereMaterial);
      Atmosphere.rotation.z = 0.41;
      planet.add(Atmosphere);
    }

    // Add planet system to planet3d object and to the scene
    planet3d.add(planetSystem);
    scene.add(planet3d);
    return { name: planetName, planet, planet3d, Atmosphere, planetSystem, Ring };
  }

  // ****** LOADING OBJECTS METHOD ******
  function loadObject(path, position, scale, callback) {
    const loader = new GLTFLoader();

    loader.load(path, function (gltf) {
      const obj = gltf.scene;
      obj.position.set(position, 0, 0);
      obj.scale.set(scale, scale, scale);
      scene.add(obj);
      if (callback) {
        callback(obj);
      }
    }, undefined, function (error) {
      console.error('An error happened', error);
    });
  }

  // ****** CREATE PLANET MATERIAL FUNCTION ******
  const createPlanetMaterial = (planet) => {
    const { pl_name, st_teff, texturePath } = planet;

    // Carregar a textura do planeta
    const texture = texturePath ? loadTexture.load(texturePath) : null;

    // Escolher a cor do planeta baseada na temperatura efetiva (st_teff)
    let planetColor;
    if (st_teff < 4000) {
      // Estrelas ou planetas frios - cor mais avermelhada
      planetColor = 0xff4500;
    } else if (st_teff < 6000) {
      // Estrelas ou planetas com temperatura média - cor amarelada
      planetColor = 0xffd700;
    } else {
      // Estrelas ou planetas quentes - cor esbranquiçada
      planetColor = 0xffffff;
    }

    // Criar o material do planeta
    const planetMaterial = new MeshStandardMaterial({
      map: texture, // Usa a textura se estiver disponível
      color: planetColor, // Define a cor baseada na temperatura
      emissive: planetColor, // Define a emissividade para dar um brilho correspondente à cor
      emissiveIntensity: 0.5, // Ajuste de intensidade para manter um brilho leve
    });

    return planetMaterial;
  };

  // ****** ZONA HABITÁVEL ******
  function createHabitableZone(innerLimit, outerLimit) {
    // Multiplicar os limites por 90 para obter as distâncias corretas
    const innerRadius = innerLimit * 90;
    const outerRadius = outerLimit * 90;

    // Criar geometria do anel
    const habitableZoneGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
    const habitableZoneMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Verde para representar a zona habitável
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2 // Deixar a zona levemente transparente
    });

    // Criar a malha do anel
    const habitableZone = new THREE.Mesh(habitableZoneGeometry, habitableZoneMaterial);
    habitableZone.rotation.x = -Math.PI / 2; // Alinhar o anel com o plano da órbita

    // Adicionar a zona habitável à cena
    scene.add(habitableZone);

    return habitableZone;
  }

  const habitableZone = createHabitableZone(Ai, Ae);

  // ****** CRIAÇÃO DO PLANETA ******
  const pl_name = pl_name; // Nome do planeta do JSON
  const nome = pl_name;
  const pl_rade = pl_rade; // Raio do planeta do JSON
  const radios = pl_rade * 6.4;
  const radiosEx = pl_rade * 6371;
  const pl_orbsmax = pl_orbsmax; // Semi-eixo maior da órbita do JSON
  let reajuste;
  if (pl_orbsmax < 0.9) {
    reajuste = 0.9 * 90;
  } else if (pl_orbsmax > 6) {
    reajuste = 6 * 90;
  } else {
    reajuste = pl_orbsmax * 90;
  }
  const dist = pl_orbsmax * 150;
  const material = createPlanetMaterial(planetDataExo);
  const earth = createPlanet(nome, radios, reajuste, 23, earthTexture, null, null, earthAtmosphere);

  // ****** DADOS DO PLANETA ******
  const planetData = {
    [nome]: {
      radius: `${radiosEx} km`,
      tilt: '23.5°',
      rotation: '24 hours',
      orbit: '365 days',
      distance: `${dist} million km`,
      info: 'Third planet from the Sun and the only known planet to harbor life.'
    },
  };

  // ****** ARRAY DE PLANETAS PARA RAYCASTING ******
  const raycastTargets = [
    earth.planet, earth.Atmosphere,
    // Adicione outros planetas aqui se houver
  ];

  // ****** SHADOWS ******
  renderer.shadowMap.enabled = true;
  pointLight.castShadow = true;

  // Propriedades para o point light
  pointLight.shadow.mapSize.width = 1024;
  pointLight.shadow.mapSize.height = 1024;
  pointLight.shadow.camera.near = 10;
  pointLight.shadow.camera.far = 20;

  // Casting e recebendo sombras
  earth.planet.castShadow = true;
  earth.planet.receiveShadow = true;
  earth.Atmosphere.castShadow = true;
  earth.Atmosphere.receiveShadow = true;

  // ****** ANIMATE FUNCTION ******
  function animate() {
    // Rotating planets around the sun and itself
    sun.rotateY(0.001 * settings.acceleration);
    earth.planet.rotateY(0.005 * settings.acceleration);
    earth.Atmosphere.rotateY(0.001 * settings.acceleration);
    earth.planet3d.rotateY(0.001 * settings.accelerationOrbit);

    // ****** OUTLINES ON PLANETS ******
    raycaster.setFromCamera(mouse, camera);

    // Check for intersections
    const intersects = raycaster.intersectObjects(raycastTargets);

    // Reset all outlines
    outlinePass.selectedObjects = [];

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;

      // If the intersected object is an atmosphere, find the corresponding planet
      if (intersectedObject === earth.Atmosphere) {
        outlinePass.selectedObjects = [earth.planet];
      } else {
        // For other planets, outline the intersected object itself
        outlinePass.selectedObjects = [intersectedObject];
      }
    }

    // ****** ZOOM IN/OUT ******
    if (isMovingTowardsPlanet) {
      // Smoothly move the camera towards the target position
      camera.position.lerp(targetCameraPosition, 0.03);

      // Check if the camera is close to the target position
      if (camera.position.distanceTo(targetCameraPosition) < 1) {
        isMovingTowardsPlanet = false;
        showPlanetInfo(selectedPlanet.name);
      }
    } else if (isZoomingOut) {
      camera.position.lerp(zoomOutTargetPosition, 0.05);

      if (camera.position.distanceTo(zoomOutTargetPosition) < 1) {
        isZoomingOut = false;
      }
    }

    controls.update();
    requestAnimationFrame(animate);
    composer.render();
  }
  animate();

  // ****** EVENT LISTENERS ******
  window.addEventListener('mousemove', onMouseMove, false);
  window.addEventListener('mousedown', onDocumentMouseDown, false);
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Inicializar a aplicação
init();
