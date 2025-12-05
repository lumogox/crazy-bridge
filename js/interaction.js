import * as THREE from 'three';
import { state } from './appState.js';
import { bridgeGroup, removeVoxelAt, getVoxelKey, bridgeVoxelMap } from './bridge.js';
import { debrisList, createDebris } from './physics/StructuralIntegrity.js';

export class InteractionManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isMouseDown = false;
        this.grabbedObject = null; // { type, ref, offset, distance }
        this.dragPlane = new THREE.Plane(); // Virtual plane for dragging

        // Reticle
        const reticleGeo = new THREE.RingGeometry(2, 2.5, 32);
        reticleGeo.rotateX(-Math.PI / 2);
        const reticleMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.8,
            depthTest: false,
            side: THREE.DoubleSide
        });
        this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
        this.reticle.renderOrder = 999;
        this.scene.add(this.reticle);

        // Events
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Block right-click menu
    }

    onMouseMove(event) {
        // Normalize mouse coordinates (-1 to 1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onMouseDown(event) {
        this.isMouseDown = true;

        // Raycast
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersections = this.getIntersections();

        if (intersections.length === 0) return;

        const hit = intersections[0];

        // Left Click: Explode
        if (event.button === 0) {
            this.triggerExplosion(hit);
        }
        // Right Click: Grab
        else if (event.button === 2) {
            this.grabObject(hit);
        }
    }

    onMouseUp(event) {
        this.isMouseDown = false;
        if (event.button === 2) {
            this.releaseObject();
        }
    }

    getIntersections() {
        const objects = [];

        // 1. Bridge
        if (bridgeGroup) {
            objects.push(bridgeGroup);
        }

        // 2. Debris
        debrisList.forEach(d => objects.push(d.mesh));

        // 3. Cars
        // We need to gather all InstancedMeshes
        // Note: Raycasting against InstancedMesh is supported by Three.js
        if (state.carMeshes) {
            Object.values(state.carMeshes).forEach(m => {
                objects.push(m.body);
            });
        }

        // Recursive true to hit children of groups (like bridgeGroup)
        return this.raycaster.intersectObjects(objects, true);
    }

    triggerExplosion(hit) {
        const point = hit.point;

        // Visuals
        if (state.callbacks && state.callbacks.spawnExplosion) {
            state.callbacks.spawnExplosion(point.x, point.y, point.z, 2.0);
        }

        // Damage Bridge
        const radius = 25; // Destruction radius
        const step = 10;
        let destroyed = false;

        for (let dx = -radius; dx <= radius; dx += step) {
            for (let dz = -radius; dz <= radius; dz += step) {
                if (dx*dx + dz*dz <= radius*radius) {
                   const removed = removeVoxelAt(point.x + dx, point.z + dz);
                   if (removed) destroyed = true;
                }
            }
        }

        // Apply Force to Dynamic Objects (Cars, Debris)
        const forceRadius = 100;
        const forceStrength = 200;

        // Cars
        state.trafficData.forEach(car => {
            const dist = Math.sqrt((car.x - point.x)**2 + (car.z - point.z)**2 + (car.y - point.y)**2);
            if (dist < forceRadius) {
                car.isFalling = true;
                car.crashed = true;

                // Direction away from explosion
                const angle = Math.atan2(car.z - point.z, car.x - point.x);
                const power = (1 - dist / forceRadius) * forceStrength;

                car.vx += Math.cos(angle) * power;
                car.vz += Math.sin(angle) * power;
                car.vy += power * 0.5; // Upward kick
                car.vr.set(Math.random(), Math.random(), Math.random());
            }
        });

        // Debris
        debrisList.forEach(d => {
            const pos = d.mesh.position;
            const dist = pos.distanceTo(point);
            if (dist < forceRadius) {
                const dir = pos.clone().sub(point).normalize();
                const power = (1 - dist / forceRadius) * forceStrength * 0.1; // Debris is lighter?

                // No explicit velocity on debris except vy currently
                // We might need to add vx/vz to debris for this to work well
                // But for now, let's just kick it up
                d.vy += power;
            }
        });
    }

    grabObject(hit) {
        const obj = hit.object;
        let target = null;
        let type = '';

        // Check what we hit
        // 1. Debris
        const debrisIndex = debrisList.findIndex(d => d.mesh === obj);
        if (debrisIndex !== -1) {
            target = debrisList[debrisIndex];
            type = 'debris';
        }

        // 2. Car
        else if (obj.isInstancedMesh && state.carMeshes) {
             // Check if it belongs to any car mesh
             // We need to find the specific car in trafficData
             // hit.instanceId gives the index

             // Find which type it is
             let foundType = null;
             for (const [t, meshGroup] of Object.entries(state.carMeshes)) {
                 if (meshGroup.body === obj || meshGroup.windows === obj || meshGroup.wheels === obj) {
                     foundType = t;
                     break;
                 }
             }

             if (foundType) {
                 const car = state.trafficData.find(c => c.type === foundType && c.typeIndex === hit.instanceId);
                 if (car) {
                     target = car;
                     type = 'car';

                     // Stop it
                     car.velocity = 0;
                     car.acceleration = 0;
                     car.isFalling = true; // Take over physics
                     car.vx = 0; car.vy = 0; car.vz = 0;
                 }
             }
        }

        // 3. Static Bridge Voxel
        else if (obj.parent === bridgeGroup) {
            // We hit a static voxel. Convert it to debris!
            // We need the precise grid location.
            // Hit point is on the face. Move slightly inside to get the center?
            // Or use getVoxelKey logic with slight tolerance?

            // Best: Use hit.point and normal to step INTO the block
            const p = hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.5));
            const removed = removeVoxelAt(p.x, p.z);

            if (removed) {
                // removeVoxelAt returns an array of voxel data objects
                // We pick the one that was likely hit or just the first one?
                // Usually it's a stack. We should probably grab the top-most?
                // Or just create debris for all and grab the first one?

                // For simplicity, spawn all, grab the first
                removed.forEach((v, i) => {
                    const d = createDebris(v, this.scene);
                    if (i === 0) {
                        target = d;
                        type = 'debris';
                    }
                });
            }
        }

        if (target) {
            // Setup Drag Plane (facing camera)
            this.dragPlane.setFromNormalAndCoplanarPoint(
                this.camera.getWorldDirection(new THREE.Vector3()),
                hit.point
            );

            this.grabbedObject = {
                type: type,
                ref: target,
                distance: this.camera.position.distanceTo(hit.point),
                offset: new THREE.Vector3() // Could calculate offset from center
            };
        }
    }

    releaseObject() {
        if (!this.grabbedObject) return;

        const obj = this.grabbedObject.ref;
        // Optional: Throw logic (using last velocity)
        // For now, just let gravity take over

        if (this.grabbedObject.type === 'car') {
            obj.isFalling = true; // Ensure gravity applies
        }

        this.grabbedObject = null;
    }

    update(dt) {
        // Update Reticle
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.getIntersections();

        if (hits.length > 0) {
            const hit = hits[0];
            this.reticle.visible = true;
            this.reticle.position.copy(hit.point);
            this.reticle.lookAt(hit.point.clone().add(hit.face.normal));

            // Pulse effect
            const s = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            this.reticle.scale.set(s, s, s);
        } else {
            this.reticle.visible = false;
        }

        // Update Grabbed Object
        if (this.grabbedObject) {
            // Project mouse to drag plane
            this.raycaster.ray.intersectPlane(this.dragPlane, new THREE.Vector3());
            // Actually, simplified: Point at distance
            const targetPos = new THREE.Vector3()
                .copy(this.raycaster.ray.origin)
                .add(this.raycaster.ray.direction.multiplyScalar(this.grabbedObject.distance));

            const obj = this.grabbedObject.ref;
            const lerpFactor = 10 * dt;

            if (this.grabbedObject.type === 'debris') {
                obj.mesh.position.lerp(targetPos, lerpFactor);
                obj.vy = 0; // Cancel gravity
            } else if (this.grabbedObject.type === 'car') {
                // Lerp x, y, z
                const currentPos = new THREE.Vector3(obj.x, obj.y, obj.z);
                currentPos.lerp(targetPos, lerpFactor);
                obj.x = currentPos.x;
                obj.y = currentPos.y;
                obj.z = currentPos.z;

                obj.vx = 0; obj.vy = 0; obj.vz = 0; // Cancel physics
                obj.velocity = 0;
            }
        }
    }
}
