// --- Three.js Setup ---
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 80, 180);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Orbit Controls (Mouse & Touch backup)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 2, 500);
scene.add(pointLight);

// --- Solar System Objects ---
const system = new THREE.Group();
scene.add(system);

function createPlanet(size, distance, color, name) {
    const geometry = new THREE.SphereGeometry(size, 32, 32);
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: 0.7,
        metalness: 0.1
    });
    
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = distance;
    pivot.add(mesh);
    system.add(pivot);
    
    if (distance > 0) {
        const pathGeo = new THREE.RingGeometry(distance - 0.1, distance + 0.1, 64);
        const pathMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
        const path = new THREE.Mesh(pathGeo, pathMat);
        path.rotation.x = Math.PI / 2;
        system.add(path);
    }

    return { pivot, mesh, name, distance };
}

// Sun
const sunGeo = new THREE.SphereGeometry(15, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 }); // Glowing sun
const sun = new THREE.Mesh(sunGeo, sunMat);
system.add(sun);

// Add planets
const planets = [
    createPlanet(1.2, 25, 0xaaaaaa, 'Mercury'),
    createPlanet(2.5, 35, 0xe3bb76, 'Venus'),
    createPlanet(3.0, 50, 0x2b82c9, 'Earth'),
    createPlanet(1.8, 65, 0xc1440e, 'Mars'),
    createPlanet(6.0, 95, 0xd8ca9d, 'Jupiter'),
    createPlanet(5.0, 125, 0xead6b8, 'Saturn'),
    createPlanet(3.5, 155, 0xd1e7e7, 'Uranus'),
    createPlanet(3.3, 175, 0x3d5ef9, 'Neptune'),
];

// Saturn's ring
const saturn = planets[5].mesh;
const ringGeo = new THREE.RingGeometry(7, 12, 32);
const ringMat = new THREE.MeshStandardMaterial({ color: 0xead6b8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2 - 0.2;
saturn.add(ring);

// Stars
const starsGeo = new THREE.BufferGeometry();
const starsCount = 3000;
const posArray = new Float32Array(starsCount * 3);
for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 1000;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starsMat = new THREE.PointsMaterial({ size: 0.7, color: 0xffffff });
const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

// --- Animation & Gestures ---
let targetRotationX = 0;
let targetRotationY = 0;
let targetZoom = camera.position.z;

// Override variables for gesture control
let gestureControlActive = false;

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.0005;
    planets.forEach((p) => {
        const speed = 1 / Math.sqrt(p.distance); 
        p.pivot.rotation.y = time * speed * 3;
        p.mesh.rotation.y += 0.02;
    });
    
    if (gestureControlActive) {
        // Smoothly interpolate rotation
        system.rotation.x += (targetRotationX - system.rotation.x) * 0.1;
        system.rotation.y += (targetRotationY - system.rotation.y) * 0.1;
        
        // Smoothly interpolate zoom
        camera.position.z += (targetZoom - camera.position.z) * 0.1;
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- MediaPipe Hands ---
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-webcam');
const statusEl = document.getElementById('status');

statusEl.innerText = "Ready. Click button to enable gestures.";

let isWebcamActive = false;
let prevHandX = null;
let prevHandY = null;
let prevPinchDist = null;
const ZOOM_SENSITIVITY = 100;
const ROTATION_SENSITIVITY = 2.5;

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        gestureControlActive = true;
        const landmarks = results.multiHandLandmarks[0];
        
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 2});
        
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dz = thumbTip.z - indexTip.z;
        const pinchDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        const centerHandX = (thumbTip.x + indexTip.x) / 2;
        const centerHandY = (thumbTip.y + indexTip.y) / 2;
        
        if (pinchDist < 0.08) {
            statusEl.innerText = "Gesture: Pinch (Zooming)";
            if (prevHandY !== null) {
                const deltaY = centerHandY - prevHandY;
                targetZoom += deltaY * ZOOM_SENSITIVITY;
                targetZoom = Math.max(40, Math.min(500, targetZoom));
            }
            prevHandX = null; 
            prevHandY = centerHandY;
        } else {
            statusEl.innerText = "Gesture: Open Hand (Rotating)";
            if (prevHandX !== null && prevHandY !== null) {
                const deltaX = centerHandX - prevHandX;
                const deltaY = centerHandY - prevHandY;
                
                targetRotationY += deltaX * ROTATION_SENSITIVITY;
                targetRotationX += deltaY * ROTATION_SENSITIVITY;
            }
            prevHandX = centerHandX;
            prevHandY = centerHandY;
        }
    } else {
        statusEl.innerText = "Hand not detected. Use mouse.";
        gestureControlActive = false;
        prevHandX = null;
        prevHandY = null;
        // Sync targets with current state so it doesn't snap back when hand returns
        targetRotationX = system.rotation.x;
        targetRotationY = system.rotation.y;
        targetZoom = camera.position.z;
    }
    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(onResults);

startBtn.addEventListener('click', () => {
    if (!isWebcamActive) {
        startBtn.innerText = "Starting Camera...";
        statusEl.innerText = "Loading AI models...";
        
        const cameraObj = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 320,
            height: 240
        });
        
        cameraObj.start().then(() => {
            isWebcamActive = true;
            canvasElement.style.display = 'block';
            startBtn.innerText = "Camera Active";
            startBtn.style.background = "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)";
            statusEl.innerText = "Show your hand to the camera!";
        }).catch(err => {
            console.error(err);
            statusEl.innerText = "Error accessing camera.";
            startBtn.innerText = "Retry Camera";
        });
    }
});
