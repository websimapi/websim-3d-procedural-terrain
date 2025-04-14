import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 40, 80); // Adjusted camera position for better initial view
camera.lookAt(0, 0, -50); // Look down the terrain slope

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
controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below the horizon

// Terrain chunk system
const CHUNK_SIZE = 50; // Size of each terrain chunk
const RENDER_DISTANCE = 3; // How many chunks to render in each direction
const loadedChunks = new Map(); // Track loaded chunks

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

// Generate terrain chunk at specified coordinates
function createTerrainChunk(chunkX, chunkZ) {
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 40, 40);
    
    // Apply noise to create height map
    const vertices = geometry.attributes.position.array;
    
    // Create trenches/holes locations - unique to each chunk based on chunk position
    const chunkSeed = chunkX * 1000 + chunkZ;
    const random = new Math.seedrandom(chunkSeed.toString());
    
    const holes = [];
    for (let i = 0; i < 8; i++) {
        holes.push({
            x: random() * (CHUNK_SIZE * 0.8) - (CHUNK_SIZE * 0.4),
            z: random() * (CHUNK_SIZE * 0.8) - (CHUNK_SIZE * 0.4),
            radius: random() * 3 + 1.5,
            depth: random() * 8 + 5
        });
    }
    
    // World position offset for this chunk
    const offsetX = chunkX * CHUNK_SIZE;
    const offsetZ = chunkZ * CHUNK_SIZE;
    
    for (let i = 0; i < vertices.length; i += 3) {
        // Local coordinates within the chunk
        const localX = vertices[i];
        const localZ = vertices[i + 2];
        
        // World coordinates
        const worldX = localX + offsetX;
        const worldZ = localZ + offsetZ;
        
        // Normalize coordinates for noise function
        const nx = worldX * 0.05;
        const nz = worldZ * 0.05;
        
        // Get base height from noise
        let y = noise(nx, nz);
        
        // Create trenches/holes
        for (const hole of holes) {
            const dx = localX - hole.x;
            const dz = localZ - hole.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < hole.radius) {
                const depth = (1 - distance / hole.radius) * hole.depth;
                y -= depth;
            }
        }
        
        // Make terrain angle downward
        y -= worldX * 0.2;
        
        // Create empty space on far left and right (just clouds)
        if (worldX < -150 || worldX > 150) {
            y = -20; // Push these areas down below the clouds
        }
        
        vertices[i + 1] = y;
    }
    
    geometry.computeVertexNormals();
    
    // Create material with height-based coloring
    const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        flatShading: true
    });
    
    // Generate vertex colors based on height
    const colors = [];
    for (let i = 0; i < vertices.length; i += 3) {
        const height = vertices[i + 1];
        
        let color;
        if (height < -10) {
            // Deep trench - dark blue/gray
            color = new THREE.Color(0x2c3e50);
        } else if (height < -5) {
            // Trench - darker green
            color = new THREE.Color(0x27ae60);
        } else if (height < 5) {
            // Base level - green
            color = new THREE.Color(0x3a7e4a);
        } else if (height < 15) {
            // Higher areas - lighter green
            color = new THREE.Color(0x7dcea0);
        } else {
            // Highest peaks - very light green/gray
            color = new THREE.Color(0xa9cce3);
        }
        
        colors.push(color.r, color.g, color.b);
    }
    
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2; // Rotate to horizontal plane
    terrain.position.set(offsetX, 0, offsetZ);
    
    return terrain;
}

// Load chunks around camera
function updateChunks() {
    // Determine which chunk the camera is over
    const camChunkX = Math.floor(camera.position.x / CHUNK_SIZE);
    const camChunkZ = Math.floor(camera.position.z / CHUNK_SIZE);
    
    // Track which chunks should be loaded
    const chunksToKeep = new Set();
    
    // Load chunks in render distance
    for (let x = camChunkX - RENDER_DISTANCE; x <= camChunkX + RENDER_DISTANCE; x++) {
        for (let z = camChunkZ - RENDER_DISTANCE; z <= camChunkZ + RENDER_DISTANCE; z++) {
            const chunkKey = `${x},${z}`;
            chunksToKeep.add(chunkKey);
            
            // If chunk not already loaded, create it
            if (!loadedChunks.has(chunkKey)) {
                const newChunk = createTerrainChunk(x, z);
                scene.add(newChunk);
                loadedChunks.set(chunkKey, newChunk);
            }
        }
    }
    
    // Remove chunks outside render distance
    for (const [key, chunk] of loadedChunks.entries()) {
        if (!chunksToKeep.has(key)) {
            scene.remove(chunk);
            loadedChunks.delete(key);
            // Free resources
            chunk.geometry.dispose();
            chunk.material.dispose();
        }
    }
}

// Add clouds
function createClouds() {
    const clouds = new THREE.Group();
    
    // Create more clouds on the left and right where there's no terrain
    for (let i = 0; i < 50; i++) {
        let x;
        // Place more clouds on the far left and right
        if (i < 20) {
            x = Math.random() * 50 - 175; // Far left
        } else if (i < 40) {
            x = Math.random() * 50 + 175;  // Far right
        } else {
            x = Math.random() * 300 - 150; // Everywhere
        }
        
        const y = Math.random() * 10 + 15; // Height
        const z = Math.random() * 300 - 150; // Depth
        
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

// Add clouds to the scene
const clouds = createClouds();
scene.add(clouds);

// Initial chunk loading
updateChunks();

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Update terrain chunks when camera moves
    updateChunks();
    
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