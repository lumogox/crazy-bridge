import * as THREE from 'three';
import { state } from './appState.js';
import { checkStructuralIntegrity, initStructuralIntegrity } from './physics/StructuralIntegrity.js';

// Map to store voxel data for gameplay logic (destruction, collision)
// Key: "x,z" (rounded to grid) -> Value: { mesh: THREE.InstancedMesh, index: number }[]
export const bridgeVoxelMap = new Map();

// Grid size for voxels
const GRID_SIZE = 10;

export function getVoxelKey(x, z) {
    const gx = Math.floor(x / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
    const gz = Math.floor(z / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
    return `${gx},${gz}`;
}

export function removeVoxelAt(x, z) {
    const key = getVoxelKey(x, z);
    if (bridgeVoxelMap.has(key)) {
        // [CHANGE] Capture the voxel Y level (approx) before deletion for integrity check
        // We take the first voxel in the stack to determine the "destruction center"
        const voxels = bridgeVoxelMap.get(key);
        const refVoxel = voxels[0];
        const destroyY = refVoxel ? refVoxel.y : 67; // Default to deck height if undefined

        const dummy = new THREE.Object3D();
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();

        voxels.forEach(v => {
            v.mesh.setMatrixAt(v.index, dummy.matrix);
            v.mesh.instanceMatrix.needsUpdate = true;
        });

        bridgeVoxelMap.delete(key);

        // [CHANGE] Trigger integrity check after removal
        // Note: We need access to the scene, but this function doesn't receive it.
        // We can access it via the mesh parent if needed, or assume global state.
        // Or we pass scene to createBridge and store it?
        // Let's assume the voxel mesh is attached to the scene via groups.
        const sceneRef = voxels[0].mesh.parent;
        if (sceneRef) {
            checkStructuralIntegrity(x, destroyY, z, sceneRef);
        }

        return true;
    }
    return false;
}

export function createBridge(scene) {
    const bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);

    // [CHANGE] Init physics system
    initStructuralIntegrity(scene);

    const orangeMaterial = new THREE.MeshStandardMaterial({ color: 0xf04a00, roughness: 0.4 });
    const greyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });

    function createInstancedVoxels(data, material, isDynamic = false) {
        if (data.length === 0) return null;
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.InstancedMesh(geometry, material, data.length);
        const dummy = new THREE.Object3D();

        data.forEach((d, i) => {
            dummy.position.set(d.x, d.y, d.z);
            dummy.scale.set(d.sx, d.sy, d.sz);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);

            // Register dynamic voxels in the map
            if (isDynamic && d.isDestructible) {
                const key = getVoxelKey(d.x, d.z);
                if (!bridgeVoxelMap.has(key)) {
                    bridgeVoxelMap.set(key, []);
                }
                // [FIX] Store full spatial data for integrity checks
                bridgeVoxelMap.get(key).push({
                    mesh: mesh,
                    index: i,
                    x: d.x, y: d.y, z: d.z,
                    sx: d.sx, sy: d.sy, sz: d.sz
                });
            }
        });

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        bridgeGroup.add(mesh);
        return mesh;
    }

    const orangeVoxels = [];
    const greyVoxels = [];

    const towerHeight = 220;
    const towerWidth = 30;
    const towerDepth = 20;
    const towerSpacing = 1280;
    const deckHeight = 67;

    function buildTower(x) {
        const legDist = 40;
        orangeVoxels.push({ x: x, y: towerHeight / 2 - 20, z: legDist, sx: towerWidth, sy: towerHeight, sz: towerDepth });
        orangeVoxels.push({ x: x, y: towerHeight / 2 - 20, z: -legDist, sx: towerWidth, sy: towerHeight, sz: towerDepth });

        for (let y = deckHeight + 20; y < towerHeight - 20; y += 40) {
            orangeVoxels.push({ x: x, y: y, z: 0, sx: towerWidth - 5, sy: 10, sz: legDist * 2 });
        }

        orangeVoxels.push({ x: x, y: towerHeight - 10, z: 0, sx: towerWidth + 5, sy: 20, sz: legDist * 2 + towerDepth });

        // Beacon
        const beacon = new THREE.PointLight(0xff0000, 0, 500);
        beacon.position.set(x, towerHeight + 10, 0);
        scene.add(beacon);
        state.towerBeacons.push(beacon);

        // Visual beacon mesh
        orangeVoxels.push({ x: x, y: towerHeight + 5, z: 0, sx: 4, sy: 10, sz: 4 });
    }

    buildTower(-towerSpacing / 2);
    buildTower(towerSpacing / 2);

    // --- Voxelized Deck Generation ---
    const totalLength = 2800;
    const bridgeWidth = 80;
    const supportWidth = 70;

    // We iterate to create small voxels for the deck instead of one big block
    const xStart = -totalLength / 2;
    const xEnd = totalLength / 2;
    const zStart = -bridgeWidth / 2; // -40
    const zEnd = bridgeWidth / 2;    // 40

    for (let x = xStart + GRID_SIZE / 2; x < xEnd; x += GRID_SIZE) {
        // Grey Road Surface
        for (let z = zStart + GRID_SIZE / 2; z < zEnd; z += GRID_SIZE) {
            greyVoxels.push({
                x: x, y: deckHeight, z: z,
                sx: GRID_SIZE, sy: 2, sz: GRID_SIZE,
                isDestructible: true
            });
        }

        // Orange Support Structure (slightly narrower)
        // Check if this X/Z column is within support width
        const zSupportStart = -supportWidth / 2;
        const zSupportEnd = supportWidth / 2;

        for (let z = zStart + GRID_SIZE / 2; z < zEnd; z += GRID_SIZE) {
             if (z > zSupportStart && z < zSupportEnd) {
                 orangeVoxels.push({
                     x: x, y: deckHeight - 5, z: z,
                     sx: GRID_SIZE, sy: 8, sz: GRID_SIZE,
                     isDestructible: true
                 });
             }
        }
    }

    function buildCable(zOffset) {
        const segments = 200;
        const span = towerSpacing;
        const sag = 150;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = -span / 2 + t * span;
            const y = towerHeight - 4 * sag * Math.pow((x) / span, 2);
            orangeVoxels.push({ x: x, y: y, z: zOffset, sx: 2, sy: 2, sz: 2 });

            if (Math.abs(x) % 40 < 2) {
                orangeVoxels.push({ x: x, y: (y + deckHeight) / 2, z: zOffset, sx: 1, sy: y - deckHeight, sz: 1 });
            }
        }

        const sideLen = (totalLength - span) / 2;
        for (let i = 0; i <= 50; i++) {
            const t = i / 50;
            let x = -span / 2 - t * sideLen;
            let y = towerHeight - t * (towerHeight - deckHeight);
            orangeVoxels.push({ x: x, y: y, z: zOffset, sx: 2, sy: 2, sz: 2 });
            if (i % 5 === 0) orangeVoxels.push({ x: x, y: (y + deckHeight) / 2, z: zOffset, sx: 1, sy: y - deckHeight, sz: 1 });

            x = span / 2 + t * sideLen;
            y = towerHeight - t * (towerHeight - deckHeight);
            orangeVoxels.push({ x: x, y: y, z: zOffset, sx: 2, sy: 2, sz: 2 });
            if (i % 5 === 0) orangeVoxels.push({ x: x, y: (y + deckHeight) / 2, z: zOffset, sx: 1, sy: y - deckHeight, sz: 1 });
        }
    }

    buildCable(42);
    buildCable(-42);

    // Pass isDynamic=true to register voxels in the map
    createInstancedVoxels(orangeVoxels, orangeMaterial, true);
    createInstancedVoxels(greyVoxels, greyMaterial, true);
}
