import * as THREE from 'three';
import { bridgeVoxelMap, getVoxelKey } from '../bridge.js';

// Global list of falling debris
export const debrisList = [];
const DEBRIS_GRAVITY = 9.8 * 4; // Multiplied for visual effect
const WATER_LEVEL = 0;

// [FIX] Hardcoded to break circular dependency with bridge.js
const GRID_SIZE = 10;

// Offsets for neighbor checking (Up, Down, Left, Right)
const NEIGHBOR_OFFSETS = [
    { x: GRID_SIZE, z: 0 },
    { x: -GRID_SIZE, z: 0 },
    { x: 0, z: GRID_SIZE },
    { x: 0, z: -GRID_SIZE }
];

export function initStructuralIntegrity(scene) {
    // Placeholder for any init logic if needed
}

export function checkStructuralIntegrity(startX, startY, startZ, scene) {
    // We only care about X/Z connectivity for the bridge deck mostly,
    // but the bridge might have vertical components.
    // For now, the user request focuses on "floating voxels", which usually implies horizontal disconnection.
    // However, the graph logic should ideally be 3D?
    // The provided map `bridgeVoxelMap` is 2D (x,z) but stores a stack of voxels.
    // If we destroy a voxel, we should check the neighbors in the 2D grid.
    // If a neighbor stack is fully disconnected from anchors, it falls.

    // We will use a Set to keep track of visited 2D keys during this check
    // to avoid reprocessing the same cluster.
    const visitedGlobal = new Set();

    // Check all 4 neighbors
    for (const offset of NEIGHBOR_OFFSETS) {
        const nx = startX + offset.x;
        const nz = startZ + offset.z;
        const nKey = getVoxelKey(nx, nz);

        if (bridgeVoxelMap.has(nKey) && !visitedGlobal.has(nKey)) {
            processCluster(nx, nz, scene, visitedGlobal);
        }
    }
}

function processCluster(startX, startZ, scene, visitedGlobal) {
    // [FIX] Removed duplicate start node push (it was pushed twice in original code)
    const queue = [{ x: startX, z: startZ }];
    const clusterKeys = []; // Store keys to potentially detach
    let isAnchored = false;

    // Local visited for this BFS to build the cluster
    const clusterVisited = new Set();
    const startKey = getVoxelKey(startX, startZ);
    clusterVisited.add(startKey);
    visitedGlobal.add(startKey);

    while (queue.length > 0) {
        const current = queue.shift();
        const key = getVoxelKey(current.x, current.z);
        clusterKeys.push(key);

        // Check Anchor Condition
        if (isAnchor(current.x, current.z)) {
            isAnchored = true;
            // Optimization: We can stop BFS if we find an anchor?
            // Yes, if it's anchored, this whole connected component is safe.
            // But we must continue to mark everything reachable as "visitedGlobal"
            // so we don't check them again from another neighbor.
            // So we CANNOT break immediately if we want to update visitedGlobal correctly?
            // Actually, if we break, we just stop processing this specific cluster.
            // We only need to populate visitedGlobal to avoid re-running BFS.
            // If we stop early, we might visit these nodes again from another start point.
            // So for correctness of "visitedGlobal", we should probably continue or merge sets.
            // However, for performance, breaking is better.
            // Let's compromise: If anchored, we just set flag, but continue to drain queue
            // to populate visitedGlobal? Or just break and accept potential re-checks (safe but slower).
            // Given the grid size, full BFS is fine.
        }

        // Neighbors
        for (const offset of NEIGHBOR_OFFSETS) {
            const nx = current.x + offset.x;
            const nz = current.z + offset.z;
            const nKey = getVoxelKey(nx, nz);

            if (bridgeVoxelMap.has(nKey) && !clusterVisited.has(nKey)) {
                clusterVisited.add(nKey);
                visitedGlobal.add(nKey); // Mark as visited for the outer loop
                queue.push({ x: nx, z: nz });
            }
        }
    }

    if (!isAnchored) {
        detachCluster(clusterKeys, scene);
    }
}

function isAnchor(x, z) {
    // Tower 1: x ~ -640
    // Tower 2: x ~ 640
    // Land Left: x < -1300
    // Land Right: x > 1300

    // Tower width is approx 30-40.
    if (Math.abs(x + 640) < 40) return true;
    if (Math.abs(x - 640) < 40) return true;
    if (Math.abs(x) > 1350) return true;

    return false;
}

function detachCluster(keys, scene) {
    keys.forEach(key => {
        if (bridgeVoxelMap.has(key)) {
            const voxels = bridgeVoxelMap.get(key);

            // Hide original voxels
            const dummy = new THREE.Object3D();
            dummy.scale.set(0, 0, 0); // Hide
            dummy.updateMatrix(); // [FIX] Required to actually apply the scale 0 to the matrix

            voxels.forEach(v => {
                v.mesh.setMatrixAt(v.index, dummy.matrix);
                v.mesh.instanceMatrix.needsUpdate = true;

                // Create debris
                createDebris(v, scene);
            });

            // Remove from map so they don't block future checks or get picked up again
            bridgeVoxelMap.delete(key);
        }
    });
}

export function createDebris(voxelData, scene) {
    // Recreate the geometry/material for the falling chunk
    // voxelData has { x, y, z, sx, sy, sz, mesh }
    // We can steal the material from the mesh (it's an InstancedMesh)

    const geometry = new THREE.BoxGeometry(voxelData.sx, voxelData.sy, voxelData.sz);
    const material = voxelData.mesh.material; // Reuse material
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(voxelData.x, voxelData.y, voxelData.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);

    const debris = {
        mesh: mesh,
        vy: 0,
        vr: { // Random rotation
            x: (Math.random() - 0.5) * 2,
            y: (Math.random() - 0.5) * 2,
            z: (Math.random() - 0.5) * 2
        }
    };
    debrisList.push(debris);
    return debris;
}

export function updateDebris(dt) {
    for (let i = debrisList.length - 1; i >= 0; i--) {
        const debris = debrisList[i];

        // Gravity
        debris.vy -= DEBRIS_GRAVITY * dt;
        debris.mesh.position.y += debris.vy * dt;

        // Rotation
        debris.mesh.rotation.x += debris.vr.x * dt;
        debris.mesh.rotation.y += debris.vr.y * dt;
        debris.mesh.rotation.z += debris.vr.z * dt;

        // Water collision
        if (debris.mesh.position.y < WATER_LEVEL) {
            // Remove
            debris.mesh.parent.remove(debris.mesh);
            debris.mesh.geometry.dispose();
            debrisList.splice(i, 1);

            // Optional: Splash effect could trigger here
        }
    }
}
