import * as THREE from 'three';
import { state } from './appState.js';

// --- Volcano Logic ---

export function initDisasters(scene) {
    createVolcano(scene);
}

function createVolcano(scene) {
    // Create a low-poly cone for the volcano
    const geo = new THREE.ConeGeometry(200, 300, 32, 1, true);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 1.0,
        flatShading: true
    });

    const volcano = new THREE.Mesh(geo, mat);
    // Initial position: Hidden deep underwater
    volcano.position.set(400, -400, -600);
    scene.add(volcano);

    // Lava/Crater cap (glowing circle at the top)
    const lavaGeo = new THREE.CircleGeometry(40, 32);
    lavaGeo.rotateX(-Math.PI / 2);
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    const lava = new THREE.Mesh(lavaGeo, lavaMat);
    lava.position.y = 140; // Relative to volcano center
    volcano.add(lava);

    state.disasters.volcano.mesh = volcano;
    state.disasters.volcano.lavaMesh = lava;

    // Create a specialized particle system for the eruption
    const pGeo = new THREE.BoxGeometry(4, 4, 4);
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
    vol.mesh.position.y = -350;

    // Randomize location slightly (away from the main bridge area)
    const side = Math.random() > 0.5 ? 1 : -1;
    vol.mesh.position.x = (Math.random() - 0.5) * 1000;
    vol.mesh.position.z = side * (400 + Math.random() * 400);
}

export function updateDisasters(dt, scene) {
    updateVolcano(dt, scene);
}

function updateVolcano(dt, scene) {
    const vol = state.disasters.volcano;
    if (!vol.active) return;

    // 1. Rise Animation
    // It rises until it breaches the water surface (y > -50)
    if (vol.mesh.position.y < -50) {
        vol.mesh.position.y += 20 * dt; // Rise speed

        // Simple camera shake effect (if we had a camera reference, logic goes here)
        // For now, the visual impact of the mountain rising is sufficient
    } else {
        vol.erupting = true;
    }

    // 2. Eruption Logic
    if (vol.erupting || vol.mesh.position.y > -200) {
        spawnLava(dt, vol);
    }

    updateLavaParticles(dt, vol);

    // 3. Visual Effects
    // Pulse the lava crater light
    if (vol.lavaMesh) {
        const intensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
        vol.lavaMesh.material.color.setHSL(0.05, 1.0, 0.5 + intensity * 0.2);
    }
}

function spawnLava(dt, vol) {
    const count = Math.floor(5 + Math.random() * 5); // Particles per frame
    let spawned = 0;
    const particles = vol.particles;

    // Get the world position of the crater
    const craterPos = new THREE.Vector3(0, 140, 0);
    craterPos.applyMatrix4(vol.mesh.matrixWorld);

    for(let i=0; i<particles.length; i++) {
        if(spawned >= count) break;
        if(!particles[i].active) {
            const p = particles[i];
            p.active = true;
            p.pos.copy(craterPos);

            // Randomize velocity for a "spray" effect
            const angle = Math.random() * Math.PI * 2;
            const force = 50 + Math.random() * 100;
            const spread = 20;
            p.vel.set(
                Math.cos(angle) * spread,
                force,
                Math.sin(angle) * spread
            );

            p.life = 2.0 + Math.random() * 2.0;
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
            // Ensure inactive particles stay hidden
            // (Optimization: only update if it was just deactivated)
            dummy.scale.set(0,0,0);
        }

        // Always update matrix for simplicity in this step,
        // can be optimized to only update active ones later.
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    });

    if (needsUpdate) {
        mesh.instanceMatrix.needsUpdate = true;
    }
}
