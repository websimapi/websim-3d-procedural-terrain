import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 50);

const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('terrain-canvas'),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Add controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// A simple noise function for terrain generation
function noise(nx, nz) {
    // Use multiple frequencies to create more natural terrain
    let value = 0;
    
    // Main terrain shape
    value += Math.sin(nx * 0.5) * Math.sin(nz * 0.5) * 10;
    
    // Add some mid-level details
    value += Math.sin(nx * 1.0) * Math.sin(nz * 1.0) * 5;
    
    // Add small details
    value += Math.sin(nx * 2.0) * Math.sin(nz * 2.0) * 2.5;
    value += Math.sin(nx * 4.0) * Math.sin(nz * 4.0) * 1.25;
    
    return value;
}

// Generate terrain
function createTerrain() {
    const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
    
    // Apply noise to create height map
    const vertices = geometry.attributes.position.array;
    
    // Create trenches/holes locations
    const holes = [];
    for (let i = 0; i < 15; i++) {
        holes.push({
            x: Math.random() * 80 - 40,  // Keep holes within central area
            z: Math.random() * 80 - 40,
            radius: Math.random() * 3 + 1.5,
            depth: Math.random() * 8 + 5
        });
    }
    
    for (let i = 0; i < vertices.length; i += 3) {
        // x and z coordinates
        const x = vertices[i];
        const z = vertices[i + 2];
        
        // Normalize coordinates for noise function
        const nx = x * 0.05;
        const nz = z * 0.05;
        
        // Get base height from noise
        let y = noise(nx, nz);
        
        // Create trenches/holes
        for (const hole of holes) {
            const dx = x - hole.x;
            const dz = z - hole.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < hole.radius) {
                const depth = (1 - distance / hole.radius) * hole.depth;
                y -= depth;
            }
        }
        
        // Make terrain angle downward
        y -= x * 0.2;
        
        // Create empty space on far left and right (just clouds)
        if (x < -40 || x > 40) {
            y = -20; // Push these areas down below the clouds
        }
        
        vertices[i + 1] = y;
    }
    
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshPhongMaterial({
        color: 0x3a7e4a, // Green for terrain
        wireframe: false,
        flatShading: true
    });
    
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2; // Rotate to horizontal plane
    
    return terrain;
}

// Add clouds
function createClouds() {
    const clouds = new THREE.Group();
    
    // Create more clouds on the left and right where there's no terrain
    for (let i = 0; i < 50; i++) {
        let x;
        // Place more clouds on the far left and right
        if (i < 20) {
            x = Math.random() * 30 - 65; // Far left
        } else if (i < 40) {
            x = Math.random() * 30 + 45;  // Far right
        } else {
            x = Math.random() * 150 - 75; // Everywhere
        }
        
        const y = Math.random() * 10 + 15; // Height
        const z = Math.random() * 150 - 75; // Depth
        
        // Create a cloud consisting of multiple spheres
        const cloudGroup = new THREE.Group();
        
        // Add 3-6 spheres per cloud
        const numSpheres = Math.floor(Math.random() * 4) + 3;
        
        for (let j = 0; j < numSpheres; j++) {
            const geometry = new THREE.SphereGeometry(Math.random() * 3 + 1.5, 8, 8);
            const material = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.8
            });
            
            const sphere = new THREE.Mesh(geometry, material);
            // Position spheres relative to the cloud center
            sphere.position.set(
                Math.random() * 4 - 2, 
                Math.random() * 2 - 1, 
                Math.random() * 4 - 2
            );
            cloudGroup.add(sphere);
        }
        
        cloudGroup.position.set(x, y, z);
        clouds.add(cloudGroup);
    }
    
    return clouds;
}

// Add terrain and clouds to the scene
const terrain = createTerrain();
scene.add(terrain);

const clouds = createClouds();
scene.add(clouds);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Slowly rotate clouds for subtle movement
    clouds.children.forEach((cloud, i) => {
        cloud.rotation.y += 0.0005 * (i % 3 + 1);
    });
    
    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

