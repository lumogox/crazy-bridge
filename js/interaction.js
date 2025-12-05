import * as THREE from 'three';
import { state } from './appState.js';
import { bridgeGroup, removeVoxelAt, getVoxelKey, bridgeVoxelMap } from './bridge.js';
import { debrisList, createDebris } from './physics/StructuralIntegrity.js';

export class InteractionManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.enabled = false; // Default disabled
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isMouseDown = false;
        this.grabbedObject = null; // { type, ref, offset, distance }
        this.dragPlane = new THREE.Plane(); // Virtual plane for dragging

        // Hand Model
        this.hand = this.createHandModel();
        this.scene.add(this.hand);
        this.hand.visible = false;

        // Events
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Block right-click menu
    }

    createHandModel() {
        const handGroup = new THREE.Group();
        // [CHANGE] Make hand bigger
        handGroup.scale.set(3, 3, 3);

        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 });

        // Palm
        const palmGeo = new THREE.BoxGeometry(4, 1.5, 4);
        const palm = new THREE.Mesh(palmGeo, skinMat);
        handGroup.add(palm);

        // Fingers (Static for now, but distinct)
        const fingerGeo = new THREE.BoxGeometry(0.8, 0.8, 2.5);
        fingerGeo.translate(0, 0, -1.25); // Pivot at base

        const thumbGeo = new THREE.BoxGeometry(1.0, 0.8, 2.0);
        thumbGeo.translate(0, 0, -1.0);

        // 4 Fingers
        this.fingers = [];
        for(let i=0; i<4; i++) {
            const f = new THREE.Mesh(fingerGeo, skinMat);
            f.position.set(-1.5 + i*1.0, 0, -2);
            handGroup.add(f);
            this.fingers.push(f);
        }

        // Thumb
        const thumb = new THREE.Mesh(thumbGeo, skinMat);
        thumb.position.set(2.2, 0, 0.5);
        thumb.rotation.y = -Math.PI / 4;
        handGroup.add(thumb);
        this.thumb = thumb;

        return handGroup;
    }

    onMouseMove(event) {
        // Normalize mouse coordinates (-1 to 1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onMouseDown(event) {
        if (!this.enabled) return;
        this.isMouseDown = true;
        this.updateHandAnimation(true);

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
        this.updateHandAnimation(false);
        if (event.button === 2) {
            this.releaseObject();
        }
    }

    updateHandAnimation(closed) {
        if (closed) {
            this.fingers.forEach(f => f.rotation.x = Math.PI / 2);
            this.thumb.rotation.z = Math.PI / 4;
        } else {
            this.fingers.forEach(f => f.rotation.x = 0);
            this.thumb.rotation.z = 0;
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
        if (state.carMeshes) {
            Object.values(state.carMeshes).forEach(m => {
                objects.push(m.body);
            });
        }

        // 4. Ships
        if (state.shipGroup) {
            // [CHANGE] Recursively check children for groups (needed for ships)
            objects.push(state.shipGroup);
        }

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

        // Apply Force to Dynamic Objects
        const forceRadius = 100;
        const forceStrength = 200;

        // Cars
        state.trafficData.forEach(car => {
            const dist = Math.sqrt((car.x - point.x)**2 + (car.z - point.z)**2 + (car.y - point.y)**2);
            if (dist < forceRadius) {
                car.isFalling = true;
                car.crashed = true;

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
                const power = (1 - dist / forceRadius) * forceStrength * 0.1;
                d.vy += power;
            }
        });

        // Ships
        if (state.ships) {
            state.ships.forEach(ship => {
                const dist = ship.position.distanceTo(point);
                if (dist < forceRadius + 20) {
                    ship.userData.sinking = true;
                    // Explosion visual near ship
                    if (state.callbacks.spawnExplosion) {
                         state.callbacks.spawnExplosion(ship.position.x, ship.position.y, ship.position.z, 4.0);
                    }
                }
            });
        }
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

                     car.velocity = 0;
                     car.acceleration = 0;
                     car.isFalling = true;
                     car.vx = 0; car.vy = 0; car.vz = 0;
                 }
             }
        }

        // 3. Ships
        else if (state.ships) {
            let curr = obj;
            // Traverse up to find the ship group (it's a Group inside shipGroup)
            // state.ships contains the ship Groups
            // We need to check if 'curr' is one of the ships or its child
            // The structure is: scene -> state.shipGroup -> ship (Group) -> hull/cabin (Mesh)
            // So if we hit hull, parent is ship.
            while(curr && curr.parent !== state.shipGroup) {
                curr = curr.parent;
            }
            if (curr && state.ships.includes(curr)) {
                target = curr;
                type = 'ship';
                target.userData.isGrabbed = true;
            }
        }

        // 4. Static Bridge Voxel
        if (!target && obj.parent === bridgeGroup) {
            const p = hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.5));
            const removed = removeVoxelAt(p.x, p.z);

            if (removed) {
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
            this.dragPlane.setFromNormalAndCoplanarPoint(
                this.camera.getWorldDirection(new THREE.Vector3()),
                hit.point
            );

            this.grabbedObject = {
                type: type,
                ref: target,
                distance: this.camera.position.distanceTo(hit.point),
                offset: new THREE.Vector3()
            };
        }
    }

    releaseObject() {
        if (!this.grabbedObject) return;

        const obj = this.grabbedObject.ref;

        if (this.grabbedObject.type === 'car') {
            obj.isFalling = true;
        }
        if (this.grabbedObject.type === 'ship') {
            obj.userData.isGrabbed = false;
            obj.userData.speed = 10;
            obj.userData.sinking = false;
        }

        this.grabbedObject = null;
    }

    update(dt) {
        if (!this.enabled) {
            this.hand.visible = false;
            return;
        }

        // Update Hand Position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.getIntersections();

        if (hits.length > 0) {
            const hit = hits[0];
            this.hand.visible = true;
            this.hand.position.copy(hit.point);

            // Orient to surface
            if (hit.face) {
                const lookPos = hit.point.clone().add(hit.face.normal);
                this.hand.lookAt(lookPos);
                this.hand.rotateX(-Math.PI / 2);
            }
        } else {
            // [CHANGE] Hand always visible: Project to fixed distance
            this.hand.visible = true;

            // Try intersection with ground plane y=0? Or just fixed distance?
            // Fixed distance is safer to prevent hand disappearing into infinity
            const dist = 200;
            const target = new THREE.Vector3()
                .copy(this.raycaster.ray.origin)
                .add(this.raycaster.ray.direction.multiplyScalar(dist));

            this.hand.position.lerp(target, 0.2); // Smooth follow

            // Neutral orientation (Palm downish)
            // Just use default rotation reset
            this.hand.rotation.set(0, 0, 0);
        }

        // Update Grabbed Object
        if (this.grabbedObject) {
            this.hand.visible = true;

            this.raycaster.ray.intersectPlane(this.dragPlane, new THREE.Vector3());
            const targetPos = new THREE.Vector3()
                .copy(this.raycaster.ray.origin)
                .add(this.raycaster.ray.direction.multiplyScalar(this.grabbedObject.distance));

            this.hand.position.copy(targetPos);

            // Keep hand orientation fixed while dragging?
            // Or look at camera?
            // this.hand.lookAt(this.camera.position);

            const obj = this.grabbedObject.ref;
            const lerpFactor = 10 * dt;

            if (this.grabbedObject.type === 'debris') {
                obj.mesh.position.lerp(targetPos, lerpFactor);
                obj.vy = 0;
            } else if (this.grabbedObject.type === 'car') {
                const currentPos = new THREE.Vector3(obj.x, obj.y, obj.z);
                currentPos.lerp(targetPos, lerpFactor);
                obj.x = currentPos.x;
                obj.y = currentPos.y;
                obj.z = currentPos.z;

                obj.vx = 0; obj.vy = 0; obj.vz = 0;
                obj.velocity = 0;
            } else if (this.grabbedObject.type === 'ship') {
                obj.position.lerp(targetPos, lerpFactor);
                obj.rotation.set(0, 0, 0);
            }
        }
    }
}
