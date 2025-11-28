import * as THREE from 'three';
import { state } from './appState.js';
import { removeVoxelAt, getVoxelKey } from './bridge.js';

// --- Volcano Logic ---

export function initDisasters(scene) {
    createVolcano(scene);
    // Meteor initialization (if any needed, e.g., container) is handled dynamically
}

function createVolcano(scene) {
    // [CHANGE] Create a bigger low-poly cone for the volcano
    const geo = new THREE.ConeGeometry(400, 600, 32, 1, true);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 1.0,
        flatShading: true
    });

    const volcano = new THREE.Mesh(geo, mat);
    // Initial position: Hidden deep underwater
    volcano.position.set(400, -800, -600);
    scene.add(volcano);

    // Lava/Crater cap (glowing circle at the top)
    const lavaGeo = new THREE.CircleGeometry(80, 32); // Bigger crater
    lavaGeo.rotateX(-Math.PI / 2);
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    const lava = new THREE.Mesh(lavaGeo, lavaMat);
    lava.position.y = 280; // Relative to new volcano center (height 600 / 2 - padding)
    volcano.add(lava);

    state.disasters.volcano.mesh = volcano;
    state.disasters.volcano.lavaMesh = lava;
    // [CHANGE] Store radius for collision detection
    state.disasters.volcano.radius = 250;

    // Create a specialized particle system for the eruption
    const pGeo = new THREE.BoxGeometry(8, 8, 8); // Bigger particles
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    state.disasters.volcano.particleMesh = new THREE.InstancedMesh(pGeo, pMat, 1000);

    // Initialize all particles to scale 0 (hidden)
    const dummy = new THREE.Object3D();
    dummy.scale.set(0,0,0);
    dummy.updateMatrix();
    for(let i=0; i<1000; i++) {
        state.disasters.volcano.particleMesh.setMatrixAt(i, dummy.matrix);
        state.disasters.volcano.particles.push({
            active: false,
            pos: new THREE.Vector3(),
            vel: new THREE.Vector3(),
            life: 0
        });
    }

    scene.add(state.disasters.volcano.particleMesh);
}

export function triggerVolcano() {
    const vol = state.disasters.volcano;
    if(vol.active) return; // Prevent double trigger

    vol.active = true;
    vol.erupting = false;

    // Reset position deep underwater
    vol.mesh.position.y = -650;

    // [CHANGE] Spawn closer to the bridge
    // Bridge is around Z=0. We want it close but maybe not DIRECTLY colliding with the bridge initially,
    // or maybe we DO want it to destroy the bridge? The prompt says "close to the bridge".
    const side = Math.random() > 0.5 ? 1 : -1;
    vol.mesh.position.x = (Math.random() - 0.5) * 600; // Closer X range
    vol.mesh.position.z = side * (100 + Math.random() * 100); // Much closer to Z=0
}

export function updateDisasters(dt, scene) {
    updateVolcano(dt, scene);
    updateMeteors(dt, scene);
}

// [CHANGE] Helper for collisions
export function checkVolcanoCollision(pos) {
    const vol = state.disasters.volcano;
    if (!vol.active) return false;

    // Simple distance check in XZ plane
    const distSq = (pos.x - vol.mesh.position.x) ** 2 + (pos.z - vol.mesh.position.z) ** 2;
    return distSq < (vol.radius ** 2);
}

// [CHANGE] New Helper for Lava Particle collisions
export function checkLavaCollision(pos) {
    const vol = state.disasters.volcano;
    if (!vol.active || !vol.erupting) return false;

    // Optimization: Check if within general radius first
    const dx = pos.x - vol.mesh.position.x;
    const dz = pos.z - vol.mesh.position.z;
    if (dx*dx + dz*dz > (vol.radius + 150)**2) return false; // Extended radius for flying lava

    const particles = vol.particles;
    const hitRadiusSq = 15 * 15; // Hit radius

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.active) {
            // Check distance (simple sphere)
            const pdx = pos.x - p.pos.x;
            const pdy = pos.y - p.pos.y; // Height matters for falling lava
            const pdz = pos.z - p.pos.z;

            if (pdx*pdx + pdy*pdy + pdz*pdz < hitRadiusSq) {
                p.active = false; // Destroy the rock
                // Update the mesh to hide it immediately
                const dummy = new THREE.Object3D();
                dummy.scale.set(0,0,0);
                vol.particleMesh.setMatrixAt(i, dummy.matrix);
                vol.particleMesh.instanceMatrix.needsUpdate = true;
                return true;
            }
        }
    }
    return false;
}

function updateVolcano(dt, scene) {
    const vol = state.disasters.volcano;
    if (!vol.active) return;

    // 1. Rise Animation
    // It rises until it breaches the water surface
    if (vol.mesh.position.y < -100) {
        vol.mesh.position.y += 40 * dt; // Faster rise for bigger volcano
    } else {
        vol.erupting = true;
    }

    // 2. Eruption Logic
    if (vol.erupting || vol.mesh.position.y > -400) {
        spawnLava(dt, vol);
    }

    updateLavaParticles(dt, vol);

    // 3. Visual Effects
    if (vol.lavaMesh) {
        const intensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
        vol.lavaMesh.material.color.setHSL(0.05, 1.0, 0.5 + intensity * 0.2);
    }
}

function spawnLava(dt, vol) {
    const count = Math.floor(5 + Math.random() * 10); // More particles
    let spawned = 0;
    const particles = vol.particles;

    // Get the world position of the crater
    const craterPos = new THREE.Vector3(0, 280, 0); // Adjusted for new height
    craterPos.applyMatrix4(vol.mesh.matrixWorld);

    for(let i=0; i<particles.length; i++) {
        if(spawned >= count) break;
        if(!particles[i].active) {
            const p = particles[i];
            p.active = true;
            p.pos.copy(craterPos);

            // Randomize velocity for a "spray" effect
            const angle = Math.random() * Math.PI * 2;
            const force = 80 + Math.random() * 150; // Higher force
            const spread = 40;
            p.vel.set(
                Math.cos(angle) * spread,
                force,
                Math.sin(angle) * spread
            );

            p.life = 3.0 + Math.random() * 2.0;
            spawned++;
        }
    }
}

function updateLavaParticles(dt, vol) {
    const dummy = new THREE.Object3D();
    const mesh = vol.particleMesh;
    let activeCount = 0;
    let needsUpdate = false;

    vol.particles.forEach((p, i) => {
        if (p.active) {
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                dummy.scale.set(0,0,0);
                needsUpdate = true;
            } else {
                p.vel.y -= 90.8 * dt; // Heavy gravity
                p.pos.addScaledVector(p.vel, dt);

                // Collision with water level
                if (p.pos.y < -10) {
                    p.active = false;
                    dummy.scale.set(0,0,0);
                } else {
                    dummy.position.copy(p.pos);
                    dummy.scale.set(1,1,1);
                    activeCount++;
                }
                needsUpdate = true;
            }
        } else {
            dummy.scale.set(0,0,0);
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    });

    if (needsUpdate) {
        mesh.instanceMatrix.needsUpdate = true;
    }
}

// --- Meteor Logic ---

export function triggerMeteorShower() {
    const met = state.disasters.meteors;
    if (met.active) return;
    met.active = true;
    // We will spawn particles over time in updateMeteors
}

function createMeteorVisuals(scene) {
    if (state.disasters.meteors.mesh) return;

    // Meteors
    // [CHANGE] Use IcosahedronGeometry for rocky look, scale 6 (radius)
    const geo = new THREE.IcosahedronGeometry(6, 0);
    // [CHANGE] Dark rock with glowing veins (emissive)
    const mat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        emissive: 0xff4400,
        emissiveIntensity: 3.0,
        flatShading: true
    });

    // We can use an InstancedMesh if we have many, or just regular meshes if few.
    // Let's use InstancedMesh for performance if we want a "shower".
    const mesh = new THREE.InstancedMesh(geo, mat, 100);
    scene.add(mesh);

    state.disasters.meteors.mesh = mesh;

    const dummy = new THREE.Object3D();
    dummy.scale.set(0,0,0);
    dummy.updateMatrix();
    for(let i=0; i<100; i++) {
        mesh.setMatrixAt(i, dummy.matrix);
        state.disasters.meteors.particles.push({
            active: false,
            pos: new THREE.Vector3(),
            vel: new THREE.Vector3(),
            target: new THREE.Vector3(),
            scale: 1.0 // [CHANGE] Store random scale
        });
    }
}

function updateMeteors(dt, scene) {
    const met = state.disasters.meteors;
    if (!met.active) return;

    if (!met.mesh) createMeteorVisuals(scene);

    const dummy = new THREE.Object3D();
    const mesh = met.mesh;
    let needsUpdate = false;

    // Spawn new meteors randomly
    if (Math.random() < 0.1) { // Spawn rate
        for(let i=0; i<met.particles.length; i++) {
            if(!met.particles[i].active) {
                const p = met.particles[i];
                p.active = true;

                // Pick a target on the bridge
                // Bridge length -1400 to 1400, Width -40 to 40
                const tx = (Math.random() - 0.5) * 2800;
                const tz = (Math.random() - 0.5) * 80;
                p.target.set(tx, 67, tz); // Deck height

                // Spawn high up
                p.pos.set(tx + (Math.random()-0.5)*500, 800 + Math.random()*200, tz + (Math.random()-0.5)*500);

                // Velocity towards target
                p.vel.subVectors(p.target, p.pos).normalize().multiplyScalar(400); // Fast speed

                // [CHANGE] Randomize scale
                p.scale = 2.0 + Math.random() * 2.0;

                break; // Spawn one at a time
            }
        }
    }

    met.particles.forEach((p, i) => {
        if (p.active) {
            const lastPos = p.pos.clone();
            p.pos.addScaledVector(p.vel, dt);

            // Rotation
            dummy.rotation.x += dt * 2;
            dummy.rotation.y += dt * 3;

            // Check if passed target Y (impact)
            if (p.pos.y <= p.target.y && lastPos.y > p.target.y) {
                // Impact!
                p.active = false;
                dummy.scale.set(0,0,0);
                needsUpdate = true;

                // [CHANGE] Destruction Loop (Area Damage)
                const radius = 35; // Big hole
                const step = 10; // Grid size
                for (let dx = -radius; dx <= radius; dx += step) {
                    for (let dz = -radius; dz <= radius; dz += step) {
                        // Check circular distance
                        if (dx*dx + dz*dz <= radius*radius) {
                            removeVoxelAt(p.target.x + dx, p.target.z + dz);
                        }
                    }
                }

                // [CHANGE] Visual Explosion - Massive
                if (state.callbacks && state.callbacks.spawnExplosion) {
                    // Main blast
                    state.callbacks.spawnExplosion(p.target.x, p.target.y, p.target.z, 3.0);
                    // Secondary blasts for volume
                    state.callbacks.spawnExplosion(p.target.x + 10, p.target.y, p.target.z + 10, 2.0);
                    state.callbacks.spawnExplosion(p.target.x - 10, p.target.y, p.target.z - 10, 2.0);
                }

            } else {
                dummy.position.copy(p.pos);
                // [CHANGE] Use p.scale
                const s = p.scale;
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                needsUpdate = true;
            }
        } else {
            dummy.scale.set(0,0,0);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
    });

    if (needsUpdate) {
        mesh.instanceMatrix.needsUpdate = true;
    }
}
