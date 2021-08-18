import * as THREE from './three';
import { MeshLine, MeshLineMaterial } from './mesh-line';

import points from './points.json';

const OrbitControls = require('./orbit-controls')(THREE);

/* VARIABLES */

let container,
  canvas,
  scene,
  globe,
  renderer,
  data = points,
  onInitialized;

// Three group objects
let groups = {
  main: null, // A group containing everything
  globe: null, // A group containing the globe sphere (and globe dots)
  globeDots: null, // A group containing the globe dots
};

// Map properties for creation and rendering
let props = {
  mapSize: {
    // Size of the map from the intial source image (on which the dots are positioned on)
    width: 2048 / 2,
    height: 1024 / 2,
  },
  globeRadius: 200, // Radius of the globe (used for many calculations)
  colours: {
    // Cache the colours
    globeDots: 'rgb(255, 255, 255)', // No need to use the Three constructor as this value is used for the HTML canvas drawing 'fillStyle' property
  },
  alphas: {
    // Transparent values of materials
    globe: 0.7,
  },
};

// Angles used for animating the camera
let camera = {
  object: null, // Three object of the camera
  controls: null, // Three object of the orbital controls
  angles: {
    // Object of the camera angles for animating
    current: {
      azimuthal: null,
      polar: null,
    },
    target: {
      azimuthal: null,
      polar: null,
    },
  },
};

// Booleans and values for animations
let animations = {
  dots: {
    current: 0, // Animation frames of the globe dots introduction animation
    total: 170, // Total frames (duration) of the globe dots introduction animation,
    points: [], // Array to clone the globe dots coordinates to
  },
  globe: {
    current: 0, // Animation frames of the globe introduction animation
    total: 80, // Total frames (duration) of the globe introduction animation,
  },
};

// Boolean to enable or disable rendering when window is in or out of focus
let stopped = false;

/* SETUP */

export function setupGlobe(container2: any, canvas2: any, initialized2: (() => void) | null = null) {
  stopped = false;
  container = container2;
  canvas = canvas2;
  onInitialized = initialized2;
  setupScene();
  setupEvent();
}

export function destroyGlobe() {
  stopped = true;
  animations.globe.current = 0;
  animations.dots.current = 0;
  animations.dots.points = [];
}

function setupEvent() {
  window.addEventListener('resize', canvasResizeBehaviour);
  canvasResizeBehaviour();
}

function canvasResizeBehaviour() {
  if (stopped) return;
  camera.object.aspect = container.offsetWidth / container.offsetHeight;
  camera.object.updateProjectionMatrix();
  renderer.setSize(container.offsetWidth, container.offsetHeight);
}

function setupScene() {
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    shadowMapEnabled: false,
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  // Main group that contains everything
  groups.main = new THREE.Group();
  groups.main.name = 'Main';

  // Add the main group to the scene
  scene.add(groups.main);

  // Render camera and add orbital controls
  addCamera();
  addControls();

  // Render objects
  addGlobe();

  // Start the requestAnimationFrame loop
  render();
  animate();
}

/* CAMERA AND CONTROLS */

function addCamera() {
  camera.object = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 1, 10000);
  camera.object.position.z = props.globeRadius * 2.1;
}

function addControls() {
  camera.controls = new OrbitControls(camera.object, canvas);
  camera.controls.enableKeys = false;
  camera.controls.enablePan = false;
  camera.controls.enableZoom = false;
  camera.controls.enableDamping = false;
  camera.controls.enableRotate = false;

  // Set the initial camera angles to something crazy for the introduction animation
  camera.angles.current.azimuthal = -Math.PI;
  camera.angles.current.polar = 180;
}

/* RENDERING */

function render() {
  renderer.render(scene, camera.object);
}

function animate() {
  stopped || requestAnimationFrame(animate);

  if (groups.globeDots) {
    introAnimate();
  }

  camera.controls.setAzimuthalAngle(Math.cos(Date.now() * 0.0000005) * -360);
  camera.controls.setPolarAngle(1);

  camera.controls.update();

  render();
}

/* GLOBE */

function addGlobe() {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin(true);

  const radius = props.globeRadius - props.globeRadius * 0.02;
  const segments = 64;
  const rings = 64;

  // Make gradient
  const canvasSize = 128;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = canvasSize;
  textureCanvas.height = canvasSize;
  const canvasContext = textureCanvas.getContext('2d');
  canvasContext.rect(0, 0, canvasSize, canvasSize);
  const canvasGradient = canvasContext.createLinearGradient(0, 0, 0, canvasSize);
  canvasGradient.addColorStop(1, 'rgba(0,0,0,0.02)');
  canvasGradient.addColorStop(1, 'rgba(0,0,0,0.02)');
  canvasGradient.addColorStop(1, 'rgba(0,0,0,0.02)');
  canvasContext.fillStyle = canvasGradient;
  canvasContext.fill();

  // Make texture
  const texture = new THREE.Texture(textureCanvas);
  texture.needsUpdate = true;

  const geometry = new THREE.SphereGeometry(radius, segments, rings);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
  });
  globe = new THREE.Mesh(geometry, material);

  groups.globe = new THREE.Group();
  groups.globe.name = 'Globe';

  groups.globe.add(globe);
  groups.main.add(groups.globe);

  addGlobeDots();
}

function addGlobeDots() {
  const geometry = new THREE.Geometry();

  // Make circle
  const canvasSize = 16;
  const halfSize = canvasSize / 2;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = canvasSize;
  textureCanvas.height = canvasSize;
  const canvasContext = textureCanvas.getContext('2d');
  canvasContext.beginPath();
  canvasContext.arc(halfSize, halfSize, halfSize, 0, 2 * Math.PI);
  canvasContext.fillStyle = props.colours.globeDots;
  canvasContext.fill();

  // Make texture
  const texture = new THREE.Texture(textureCanvas);
  texture.needsUpdate = true;

  const material = new THREE.PointsMaterial({
    map: texture,
    size: props.globeRadius / 200,
  });

  const addDot = function (targetX, targetY) {
    // Add a point with zero coordinates
    const point = new THREE.Vector3(0, 0, 0);
    geometry.vertices.push(point);

    // Add the coordinates to a new array for the intro animation
    const result = returnSphericalCoordinates(targetX, targetY);
    animations.dots.points.push(new THREE.Vector3(result.x, result.y, result.z));
  };

  for (let i = 0; i < data.points.length; i++) {
    addDot(data.points[i].x, data.points[i].y);
  }

  // Add the points to the scene
  groups.globeDots = new THREE.Points(geometry, material);
  groups.globe.add(groups.globeDots);
}

/* INTRO ANIMATIONS */

// Easing reference: https://gist.github.com/gre/1650294
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
const easeOutCubic = (t) => --t * t * t + 1;

function introAnimate() {
  if (animations.dots.current <= animations.dots.total) {
    let points = groups.globeDots.geometry.vertices;
    const totalLength = points.length;

    for (let i = 0; i < totalLength; i++) {
      // Check point exists
      if (!animations.dots.points[i]) return;

      // Get ease value
      let dotProgress = easeInOutCubic(animations.dots.current / animations.dots.total);

      // Add delay based on loop iteration
      dotProgress = dotProgress + dotProgress * (i / totalLength);

      if (dotProgress > 1) {
        dotProgress = 1;
      }

      // Move the point
      points[i].x = animations.dots.points[i].x * dotProgress;
      points[i].y = animations.dots.points[i].y * dotProgress;
      points[i].z = animations.dots.points[i].z * dotProgress;

      // Animate the camera at the same rate as the first dot
      if (i === 0) {
        let azimuthalDifference = (camera.angles.current.azimuthal - camera.angles.target.azimuthal) * dotProgress;
        azimuthalDifference = camera.angles.current.azimuthal - azimuthalDifference;
        camera.controls.setAzimuthalAngle(azimuthalDifference);

        let polarDifference = (camera.angles.current.polar - camera.angles.target.polar) * dotProgress;
        polarDifference = camera.angles.current.polar - polarDifference;
        camera.controls.setPolarAngle(polarDifference);
      }
    }

    animations.dots.current++;

    // Update verticies
    groups.globeDots.geometry.verticesNeedUpdate = true;

    onInitialized && onInitialized();
  }

  if (animations.dots.current >= animations.dots.total * 0.65 && animations.globe.current <= animations.globe.total) {
    const globeProgress = easeOutCubic(animations.globe.current / animations.globe.total);
    globe.material.opacity = props.alphas.globe * globeProgress;

    animations.globe.current++;
  }
}

/* COORDINATE CALCULATIONS */

// Returns an object of 3D spherical coordinates
function returnSphericalCoordinates(latitude, longitude) {
  // Convert latitude and longitude on the 90/180 degree axis
  latitude = ((latitude - props.mapSize.width) / props.mapSize.width) * -180;
  longitude = ((longitude - props.mapSize.height) / props.mapSize.height) * -90;

  // Calculate the projected starting point
  const radius = Math.cos((longitude / 180) * Math.PI) * props.globeRadius;
  const targetX = Math.cos((latitude / 180) * Math.PI) * radius;
  const targetY = Math.sin((longitude / 180) * Math.PI) * props.globeRadius;
  const targetZ = Math.sin((latitude / 180) * Math.PI) * radius;

  return {
    x: targetX,
    y: targetY,
    z: targetZ,
  };
}
