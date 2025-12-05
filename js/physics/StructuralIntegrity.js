import * as THREE from 'three';
import { bridgeVoxelMap, getVoxelKey } from '../bridge.js';

const GRID_SIZE = 10;
const OFFSETS = [
    {x: GRID_SIZE, z: 0}, {x: -GRID_SIZE, z: 0},
    {x: 0, z: GRID_SIZE}, {x: 0, z: -GRID_SIZE},
    {x: 0, z: 0, y: 1}, {x: 0, z: 0, y: -1} // Vertical if we track Y in map, but map is currently 2D (x,z) -> list of voxels
];

// Map is Key(x,z) -> [{mesh, index, y, ...}]
// We need to traverse 3D space.
// Since bridgeVoxelMap is flattened to 2D columns, we need to be careful.
// The bridge has voxels stacked in Y.
//
// Strategy:
// 1. When a voxel is removed at (x, y, z), we check its 6 neighbors in 3D.
// 2. For each neighbor, if it exists, we run a search to see if it connects to an anchor.
// 3. Anchors are:
//    - Towers: X approx +/- 640 (Tower width is small, check specific range)
//    - Ends: X < -1350 or X > 1350 (Bridge length 2800 -> +/- 1400)

const TOWER_X_POS = 640;
const TOWER_X_NEG = -640;
const TOWER_WIDTH_HALF = 20; // Tower leg width approx 30-40
const END_LIMIT = 1380; // Start of solid ground

function isAnchor(x, y, z) {
    // Check ends
    if (x >= END_LIMIT || x <= -END_LIMIT) return true;

    // Check towers
    // Towers are at +/- 640. They go from bottom to top.
    // We assume the tower structure itself is indestructible or at least fixed.
    // If a voxel is adjacent to the tower location, it's anchored.
    // [FIX] Add Z-check for tower legs/base.
    // Towers are roughly 30 wide in X and have legs at Z = +/- 40 with depth 20.
    // So legs cover Z from 30 to 50 and -50 to -30 roughly.
    // But the tower base might be wider. Let's be generous: Z within +/- 60.
    const TOWER_Z_RANGE = 60;

    if (Math.abs(z) < TOWER_Z_RANGE) {
        if (Math.abs(x - TOWER_X_POS) < TOWER_WIDTH_HALF) return true;
        if (Math.abs(x - TOWER_X_NEG) < TOWER_WIDTH_HALF) return true;
    }

    return false;
}

// Global Debris System
const debrisItems = [];
const debrisMaterialOrange = new THREE.MeshStandardMaterial({ color: 0xf04a00, roughness: 0.4 });
const debrisMaterialGrey = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
// Reuse geometry
const debrisGeometry = new THREE.BoxGeometry(1, 1, 1); // Will scale

// Instanced Mesh for Debris?
// Since debris moves every frame, InstancedMesh is good but updating 1000s of matrices can be heavy if not careful.
// But individual Meshes are worse.
// Let's stick to individual meshes for Phase 1 MVP as per plan to ensure physics works,
// unless we expect thousands. A bridge collapse could be hundreds.
// existing 'dynamic.js' uses InstancedMesh for particles.
// Let's use a simple array of meshes first for simplicity of physics logic.

let debrisGroup;

export function initStructuralIntegrity(scene) {
    debrisGroup = new THREE.Group();
    scene.add(debrisGroup);
}

export function updateDebris(dt) {
    for (let i = debrisItems.length - 1; i >= 0; i--) {
        const d = debrisItems[i];
        d.vy -= 9.8 * 5 * dt; // Heavy gravity
        d.mesh.position.addScaledVector(d.velocity, dt);
        d.mesh.position.y += d.vy * dt;

        d.mesh.rotation.x += d.vr.x * dt;
        d.mesh.rotation.y += d.vr.y * dt;
        d.mesh.rotation.z += d.vr.z * dt;

        if (d.mesh.position.y < -10) {
            // Remove
            debrisGroup.remove(d.mesh);
            debrisItems.splice(i, 1);
        }
    }
}

export function checkStructuralIntegrity(startX, startY, startZ, scene) {
    if (!debrisGroup) initStructuralIntegrity(scene);

    // We need to check the specific neighbors in 3D
    const neighbors = [
        {x: startX + GRID_SIZE, y: startY, z: startZ},
        {x: startX - GRID_SIZE, y: startY, z: startZ},
        {x: startX, y: startY + GRID_SIZE, z: startZ}, // Voxel height varies (2 or 8), assume neighbors could be close
        {x: startX, y: startY - GRID_SIZE, z: startZ},
        {x: startX, y: startY, z: startZ + GRID_SIZE},
        {x: startX, y: startY, z: startZ - GRID_SIZE}
    ];

    // But wait, the bridgeVoxelMap is 2D (x,z) -> list of vertical voxels.
    // We need to find actual existing voxels at these coordinates.

    const potentialRoots = [];

    // Helper to find a specific voxel in the map
    function findVoxel(x, y, z) {
        // We need some tolerance for Y because voxels have different heights/positions
        const key = getVoxelKey(x, z);
        if (!bridgeVoxelMap.has(key)) return null;

        const column = bridgeVoxelMap.get(key);
        // Find one that overlaps in Y
        // Our voxels are roughly GRID_SIZE or smaller in Y.
        // Let's assume exact match or close enough.
        // The grid generation uses specific Y levels.
        return column.find(v => Math.abs(v.y - y) < 5); // 5 unit tolerance
    }

    // Since we don't have a pure 3D grid, we iterate neighbors
    // AND we also need to check the column of the destroyed voxel for ones above/below.
    // The passed (startX, startY, startZ) is the one just destroyed.

    // Check 6 directions for existing neighbors
    // We try to find "solid" blocks nearby.
    // The GRID_SIZE is 10.
    const steps = [
        {dx: 10, dy: 0, dz: 0}, {dx: -10, dy: 0, dz: 0},
        {dx: 0, dy: 10, dz: 0}, {dx: 0, dy: -10, dz: 0}, // approximate Y step
        {dx: 0, dy: 0, dz: 10}, {dx: 0, dy: 0, dz: -10}
    ];

    // Actually, looking at bridge.js:
    // Deck is at y=deckHeight (67).
    // Supports are at y=deckHeight-5.
    // Cables/Towers are separate.
    // So mostly we are caring about X/Z plane connectivity for the road,
    // and vertical connectivity if we have stacked structures.

    steps.forEach(offset => {
        const vx = startX + offset.dx;
        const vy = startY + offset.dy;
        const vz = startZ + offset.dz;

        const neighbor = findVoxel(vx, vy, vz);
        if (neighbor && !neighbor.checked) {
            potentialRoots.push(neighbor);
        }
    });

    // Also check the SAME column for vertical neighbors (since map is 2D)
    // The findVoxel logic above handles searching the column, but we need to explicitly check vertical offsets
    // which we did in steps.

    // For each potential root, we run BFS.
    // Optimization: If we find a cluster is anchored, we mark all in it as safe.
    // If not anchored, we detach them.

    // We need a way to uniquely identify voxels to avoid re-visiting in BFS.
    // We can use a Set of objects, or add a temporary flag.
    // Adding a flag to the voxel object in bridgeVoxelMap is easiest.

    // Reset flags? No, we just use a new "visited" Set for each BFS run.

    const globalVisited = new Set(); // To avoid processing the same cluster twice if multiple roots point to it

    potentialRoots.forEach(root => {
        if (globalVisited.has(root)) return;

        const cluster = [];
        const queue = [root];
        const visited = new Set();
        visited.add(root);

        let isAnchored = false;

        while(queue.length > 0) {
            const current = queue.shift();
            cluster.push(current);

            // Check anchor
            if (isAnchor(current.x, current.y, current.z)) {
                isAnchored = true;
                // We can't break early easily if we want to mark ALL as visited/safe to avoid re-check
                // But for "falling" logic, we only care if the group IS anchored.
                // If it is anchored, we don't need to detach.
                // But we should continue traversal to mark them globallyVisited so we don't re-scan this safe chunk.
            }

            // Neighbors
            steps.forEach(offset => {
                const nx = current.x + offset.dx;
                const ny = current.y + offset.dy;
                const nz = current.z + offset.dz;

                const n = findVoxel(nx, ny, nz);
                if (n && !visited.has(n)) {
                    visited.add(n);
                    queue.push(n);
                }
            });

            // Limit cluster size? If it traverses the whole bridge, it's slow.
            // Optimization: If we hit an anchor, and the cluster is getting huge, maybe we can assume it's the main body.
            if (isAnchored && cluster.length > 200) {
                // Heuristic: If we found an anchor and have traversed a bunch, it's probably the main bridge.
                // Stop and mark all in queue/cluster as globalVisited.
                // But wait, if we stop, we might miss adding some nodes to globalVisited,
                // meaning we might re-scan them from another root.
                // Ideally, we just want to know "Drop" or "Not Drop".
                // If IsAnchored, we DO NOT drop.
                break;
            }
        }

        // Mark processed
        cluster.forEach(c => globalVisited.add(c));
        // Also add anything left in queue if we broke early
        queue.forEach(q => globalVisited.add(q));

        if (!isAnchored) {
            detachCluster(cluster, scene);
        }
    });
}

function detachCluster(cluster, scene) {
    cluster.forEach(voxel => {
        // 1. Hide original voxel
        // We need to update the InstancedMesh
        // bridgeVoxelMap stores { mesh, index }
        const dummy = new THREE.Object3D();
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        voxel.mesh.setMatrixAt(voxel.index, dummy.matrix);
        voxel.mesh.instanceMatrix.needsUpdate = true;

        // 2. Remove from map
        // This is tricky because the map key points to an ARRAY of voxels.
        // We need to remove this specific voxel object from that array.
        const key = getVoxelKey(voxel.x, voxel.z);
        if (bridgeVoxelMap.has(key)) {
            const arr = bridgeVoxelMap.get(key);
            const idx = arr.indexOf(voxel);
            if (idx > -1) arr.splice(idx, 1);
            if (arr.length === 0) bridgeVoxelMap.delete(key);
        }

        // 3. Create Falling Debris
        const mesh = new THREE.Mesh(
            debrisGeometry,
            voxel.mesh.material // reuse material (might be shared, check if okay)
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.position.set(voxel.x, voxel.y, voxel.z);
        mesh.scale.set(voxel.sx, voxel.sy, voxel.sz);

        debrisGroup.add(mesh);

        debrisItems.push({
            mesh: mesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                0,
                (Math.random() - 0.5) * 5
            ),
            vy: 0,
            vr: new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            )
        });
    });
}
