import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { state, config } from './appState.js';
import { getWaterHeight, getWaterNormal } from './waveMath.js';
import { checkVolcanoCollision, checkLavaCollision } from './disasters.js';
// [CHANGE] Import bridge map for ground check
import { bridgeVoxelMap, getVoxelKey } from './bridge.js';

// --- Traffic System ---

function buildCarGeometries() {
    const geoms = {};
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const scale = 1.5;

    function createWheels(xOffset, zOffset) {
        // Scale first, then translate
        const w1 = wheelGeo.clone(); w1.scale(scale, scale, scale); w1.translate(xOffset * scale, 0.35 * scale, zOffset * scale);
        const w2 = wheelGeo.clone(); w2.scale(scale, scale, scale); w2.translate(xOffset * scale, 0.35 * scale, -zOffset * scale);
        const w3 = wheelGeo.clone(); w3.scale(scale, scale, scale); w3.translate(-xOffset * scale, 0.35 * scale, zOffset * scale);
        const w4 = wheelGeo.clone(); w4.scale(scale, scale, scale); w4.translate(-xOffset * scale, 0.35 * scale, -zOffset * scale);
        return BufferGeometryUtils.mergeGeometries([w1, w2, w3, w4]);
    }

    function addDetails(bodyGeo, length, width, height) {
        // Bumpers
        const bumperGeo = new THREE.BoxGeometry(0.5 * scale, 0.4 * scale, width * scale);
        const frontBumper = bumperGeo.clone(); frontBumper.translate((length / 2 + 0.2) * scale, 0.5 * scale, 0);
        const rearBumper = bumperGeo.clone(); rearBumper.translate(-(length / 2 + 0.2) * scale, 0.5 * scale, 0);

        // Side Mirrors
        const mirrorGeo = new THREE.BoxGeometry(0.3 * scale, 0.2 * scale, 0.4 * scale);
        const leftMirror = mirrorGeo.clone(); leftMirror.translate(0.5 * scale, height * 0.6 * scale, (width / 2 + 0.1) * scale);
        const rightMirror = mirrorGeo.clone(); rightMirror.translate(0.5 * scale, height * 0.6 * scale, -(width / 2 + 0.1) * scale);

        return BufferGeometryUtils.mergeGeometries([bodyGeo, frontBumper, rearBumper, leftMirror, rightMirror]);
    }

    // Type 0: Sedan
    {
        const body = new THREE.BoxGeometry(4 * scale, 1.0 * scale, 1.8 * scale); body.translate(0, 0.8 * scale, 0);
        const cabin = new THREE.BoxGeometry(2.2 * scale, 0.7 * scale, 1.6 * scale); cabin.translate(-0.2 * scale, 1.65 * scale, 0);
        const mergedBody = BufferGeometryUtils.mergeGeometries([body, cabin]);

        geoms.sedan = {
            body: addDetails(mergedBody, 4, 1.8, 1.0),
            wheels: createWheels(1.3, 0.8),
            windows: new THREE.BoxGeometry(2.25 * scale, 0.6 * scale, 1.65 * scale).translate(-0.2 * scale, 1.65 * scale, 0)
        };
    }

    // Type 1: SUV
    {
        const body = new THREE.BoxGeometry(4.2 * scale, 1.2 * scale, 1.9 * scale); body.translate(0, 0.9 * scale, 0);
        const cabin = new THREE.BoxGeometry(2.8 * scale, 0.9 * scale, 1.8 * scale); cabin.translate(-0.3 * scale, 1.95 * scale, 0);
        const mergedBody = BufferGeometryUtils.mergeGeometries([body, cabin]);

        geoms.suv = {
            body: addDetails(mergedBody, 4.2, 1.9, 1.2),
            wheels: createWheels(1.4, 0.85),
            windows: new THREE.BoxGeometry(2.85 * scale, 0.8 * scale, 1.85 * scale).translate(-0.3 * scale, 1.95 * scale, 0)
        };
    }

    // Type 2: Sports
    {
        const body = new THREE.BoxGeometry(3.8 * scale, 0.8 * scale, 1.7 * scale); body.translate(0, 0.7 * scale, 0);
        const cabin = new THREE.BoxGeometry(1.5 * scale, 0.6 * scale, 1.5 * scale); cabin.translate(-0.2 * scale, 1.4 * scale, 0);
        const mergedBody = BufferGeometryUtils.mergeGeometries([body, cabin]);

        geoms.sports = {
            body: addDetails(mergedBody, 3.8, 1.7, 0.8),
            wheels: createWheels(1.2, 0.8),
            windows: new THREE.BoxGeometry(1.55 * scale, 0.5 * scale, 1.55 * scale).translate(-0.2 * scale, 1.4 * scale, 0)
        };
    }

    // Type 3: Truck
    {
        const chassis = new THREE.BoxGeometry(4.5 * scale, 0.5 * scale, 1.8 * scale); chassis.translate(0, 0.6 * scale, 0);
        const cab = new THREE.BoxGeometry(1.5 * scale, 1.5 * scale, 1.8 * scale); cab.translate(1.2 * scale, 1.6 * scale, 0);
        const bed = new THREE.BoxGeometry(2.5 * scale, 0.8 * scale, 1.8 * scale); bed.translate(-0.9 * scale, 1.25 * scale, 0);
        const mergedBody = BufferGeometryUtils.mergeGeometries([chassis, cab, bed]);

        geoms.truck = {
            body: addDetails(mergedBody, 4.5, 1.8, 1.5),
            wheels: createWheels(1.5, 0.8),
            windows: new THREE.BoxGeometry(1.55 * scale, 0.8 * scale, 1.85 * scale).translate(1.2 * scale, 1.8 * scale, 0)
        };
    }

    // Type 4: Van
    {
        const body = new THREE.BoxGeometry(4.2 * scale, 1.8 * scale, 1.8 * scale); body.translate(0, 1.2 * scale, 0);

        geoms.van = {
            body: addDetails(body, 4.2, 1.8, 1.8),
            wheels: createWheels(1.4, 0.8),
            windows: new THREE.BoxGeometry(1.5 * scale, 0.8 * scale, 1.85 * scale).translate(1.0 * scale, 1.8 * scale, 0)
        };
    }

    return geoms;
}

export function createTraffic(scene, trafficConfig) {
    state.trafficConfig = trafficConfig; // Store for update loop
    const count = trafficConfig ? trafficConfig.count : 400;
    const geoms = buildCarGeometries();
    const carTypes = ['sedan', 'suv', 'sports', 'truck', 'van'];

    // Materials
    const bodyMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.3, metalness: 0.7 }), // Blue
        new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.3, metalness: 0.7 }), // Red
        new THREE.MeshStandardMaterial({ color: 0x33cc33, roughness: 0.3, metalness: 0.7 }), // Green
        new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.7 }), // Silver
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.7 }), // Black
        new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3, metalness: 0.7 })  // Orange
    ];
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.1, metalness: 0.9 });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    // Initialize Meshes
    carTypes.forEach(type => {
        state.carMeshes[type] = {
            body: new THREE.InstancedMesh(geoms[type].body, bodyMaterials[0], count),
            windows: new THREE.InstancedMesh(geoms[type].windows, windowMaterial, count),
            wheels: new THREE.InstancedMesh(geoms[type].wheels, wheelMaterial, count)
        };

        // Use white material for body so we can tint it
        state.carMeshes[type].body.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.7 });

        scene.add(state.carMeshes[type].body);
        scene.add(state.carMeshes[type].windows);
        scene.add(state.carMeshes[type].wheels);

        state.carMeshes[type].body.castShadow = true;
        state.carMeshes[type].wheels.castShadow = true;

        // Initialize all to scale 0 to hide unused ones
        const dummy = new THREE.Object3D();
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        for (let i = 0; i < count; i++) {
            state.carMeshes[type].body.setMatrixAt(i, dummy.matrix);
            state.carMeshes[type].windows.setMatrixAt(i, dummy.matrix);
            state.carMeshes[type].wheels.setMatrixAt(i, dummy.matrix);
        }
    });

    // Lights
    const lightGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    state.headlightMesh = new THREE.InstancedMesh(lightGeo, headMat, count * 2);
    state.taillightMesh = new THREE.InstancedMesh(lightGeo, tailMat, count * 2);

    scene.add(state.headlightMesh);
    scene.add(state.taillightMesh);

    // Initialize Data
    for (let i = 0; i < count; i++) {
        let lane, dir, z, x;

        if (trafficConfig) {
            const laneIdx = i % trafficConfig.lanes.length;
            const laneDef = trafficConfig.lanes[laneIdx];
            lane = laneIdx;
            dir = laneDef.dir;
            z = laneDef.z;
            x = (Math.random() - 0.5) * trafficConfig.length;
        }
        const typeIndex = Math.floor(Math.random() * 5);
        const type = carTypes[typeIndex];

        const recklessness = Math.random(); // 0 to 1
        const isReckless = recklessness > 0.8;

        // Physics properties
        const velocity = 10 + Math.random() * 15 + (isReckless ? 5 : 0); // Reckless drive faster
        const acceleration = 0;
        const maxSpeed = 25 + Math.random() * 10 + (isReckless ? 10 : 0);
        const length = type === 'truck' ? 10 : (type === 'suv' || type === 'van' ? 5 : 4.5); // Use type for length
        const brakingForce = 15 + Math.random() * 10;
        const throttleForce = 2 + Math.random() * 3;
        const safeDistance = (isReckless ? 2.0 : 4.0) + Math.random() * 2; // Reckless tailgating

        state.trafficData.push({
            x, y: trafficConfig ? trafficConfig.y : 69, z, dir,
            type, typeIndex: i,
            color: new THREE.Color().setHex(Math.random() * 0xffffff),
            velocity, acceleration, maxSpeed, length,
            brakingForce, throttleForce, safeDistance,
            crashed: false,
            crashTimer: 0,
            distractionTimer: 0,
            isExploding: false,
            vx: 0, vy: 0, vz: 0, // [CHANGE] Full 3D velocity
            vr: new THREE.Vector3(),
            lane: lane,
            recklessness: recklessness,
            originalColor: state.trafficData[i] ? state.trafficData[i].color : new THREE.Color().setHex(Math.random() * 0xffffff),
            isFalling: false, // [CHANGE] New state for falling through bridge
            isCaughtInTornado: false, // [CHANGE] Tornado state
            tornadoAngle: 0
        });

        // Set color
        state.carMeshes[type].body.setColorAt(i, state.trafficData[i].originalColor);
    }
}

export function createShips(scene) {
    state.shipGroup = new THREE.Group();
    scene.add(state.shipGroup);

    for (let i = 0; i < 5; i++) {
        const ship = new THREE.Group();

        // Hull
        const hullGeo = new THREE.BoxGeometry(20, 10, 60);
        const hullMat = new THREE.MeshStandardMaterial({ color: 0x883333 });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.position.y = 5;
        ship.add(hull);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(15, 10, 10);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 15, -20);
        ship.add(cabin);

        // Lights
        const lightGeo = new THREE.BoxGeometry(1, 1, 1);
        // Port (Red)
        const portLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        portLight.position.set(-10, 10, 0);
        ship.add(portLight);
        // Starboard (Green)
        const starLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        starLight.position.set(10, 10, 0);
        ship.add(starLight);
        // Mast (White)
        const mastLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        mastLight.position.set(0, 25, -20);
        ship.add(mastLight);

        ship.position.set((Math.random() - 0.5) * 1000, -10, (Math.random() - 0.5) * 2000);
        ship.userData = { speed: 5 + Math.random() * 5, dir: Math.random() > 0.5 ? 1 : -1 };
        ship.rotation.y = ship.userData.dir === 1 ? 0 : Math.PI;

        state.shipGroup.add(ship);
        state.ships.push(ship);
    }
}

export function updateShips(dt) {
    const time = performance.now() * 0.001;
    state.ships.forEach(ship => {
        // [CHANGE] Check sinking status
        if (ship.userData.sinking) {
            ship.position.y -= 20 * dt; // Sink fast
            ship.rotation.x += 0.5 * dt;
            ship.rotation.z += 0.2 * dt;
            if (ship.position.y < -150) {
                // Reset/Respawn
                ship.userData.sinking = false;
                ship.position.y = -10;
                ship.rotation.set(0, ship.userData.dir === 1 ? 0 : Math.PI, 0);
                // Respawn far away
                ship.position.x = (Math.random() - 0.5) * 2000;
                ship.position.z = (Math.random() - 0.5) * 3000;
            }
            return;
        }

        // [CHANGE] Check volcano collision (ships hit the mountain)
        if (checkVolcanoCollision(ship.position)) {
            ship.userData.sinking = true;
        }

        const speed = ship.userData.speed;
        const dir = ship.userData.dir;

        ship.position.z += speed * dir * dt;

        // Bobbing
        ship.position.y = -10 + Math.sin(time + ship.position.x) * 1.0;
        ship.rotation.x = Math.sin(time * 0.5 + ship.position.z * 0.01) * 0.05;
        ship.rotation.z = Math.sin(time * 0.3 + ship.position.x * 0.01) * 0.05;

        // Wrap
        if (ship.position.z > 1000) ship.position.z = -1000;
        if (ship.position.z < -1000) ship.position.z = 1000;
    });
}

export function createBirds(scene) {
    const count = 100;
    const geometry = new THREE.ConeGeometry(0.5, 2, 4);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

    state.birdMesh = new THREE.InstancedMesh(geometry, material, count);
    scene.add(state.birdMesh);

    for (let i = 0; i < count; i++) {
        state.birds.push({
            pos: new THREE.Vector3((Math.random() - 0.5) * 1000, 100 + Math.random() * 100, (Math.random() - 0.5) * 1000),
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5)).normalize().multiplyScalar(20)
        });
    }
}

export function updateBirds(dt) {
    if (!state.birdMesh) return;
    const dummy = new THREE.Object3D();

    state.birds.forEach((bird, i) => {
        bird.pos.add(bird.vel.clone().multiplyScalar(dt));

        // Wrap
        if (bird.pos.x > 1000) bird.pos.x = -1000;
        if (bird.pos.x < -1000) bird.pos.x = 1000;
        if (bird.pos.z > 1000) bird.pos.z = -1000;
        if (bird.pos.z < -1000) bird.pos.z = 1000;

        // Simple noise movement
        bird.vel.x += (Math.random() - 0.5) * dt * 10;
        bird.vel.z += (Math.random() - 0.5) * dt * 10;
        bird.vel.y += (Math.random() - 0.5) * dt * 2;
        bird.vel.normalize().multiplyScalar(20);

        dummy.position.copy(bird.pos);
        dummy.lookAt(bird.pos.clone().add(bird.vel));
        dummy.updateMatrix();
        state.birdMesh.setMatrixAt(i, dummy.matrix);
    });

    state.birdMesh.instanceMatrix.needsUpdate = true;
}

export function updateTraffic(dt) {
    if (!state.carMeshes.sedan) return; // Check if initialized

    const dummy = new THREE.Object3D();
    const dummyL = new THREE.Object3D();
    const mapWidth = state.trafficConfig ? state.trafficConfig.length : 3000;
    const halfWidth = mapWidth / 2;

    // Density Control
    // Only process the first N cars based on density
    const activeCount = Math.floor(state.trafficData.length * config.trafficDensity);
    const activeCars = state.trafficData.slice(0, activeCount);

    // Hide inactive cars
    for (let i = activeCount; i < state.trafficData.length; i++) {
        const car = state.trafficData[i];
        const meshes = state.carMeshes[car.type];
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshes.body.setMatrixAt(car.typeIndex, dummy.matrix);
        meshes.windows.setMatrixAt(car.typeIndex, dummy.matrix);
        meshes.wheels.setMatrixAt(car.typeIndex, dummy.matrix);
        state.headlightMesh.setMatrixAt(car.typeIndex * 2, dummy.matrix);
        state.headlightMesh.setMatrixAt(car.typeIndex * 2 + 1, dummy.matrix);
        state.taillightMesh.setMatrixAt(car.typeIndex * 2, dummy.matrix);
        state.taillightMesh.setMatrixAt(car.typeIndex * 2 + 1, dummy.matrix);
    }

    // Spatial Partitioning: Sort cars by lane and position
    // Spatial Partitioning: Sort cars by lane and position
    // Determine max lanes from data or config
    const maxLanes = 20; // Safe upper bound
    const lanes = Array(maxLanes).fill().map(() => []);
    activeCars.forEach(car => lanes[car.lane].push(car));

    // Sort each lane
    lanes.forEach(lane => lane.sort((a, b) => a.x - b.x));

    // Fog Crash Logic
    const fogFactor = config.fogDensity / 100; // 0.0 to 1.0
    const crashMultiplier = 1 + fogFactor * 10; // 1x to 11x (1000% increase)
    const speedMult = config.speedMultiplier;

    // Physics Loop
    lanes.forEach((laneCars, laneIndex) => {
        if (laneCars.length === 0) return;
        const dir = laneCars[0].dir; // Assume all cars in lane have same dir

        laneCars.forEach((car, i) => {
            // Tornado Interaction
            if (state.disasters.tornado.active) {
                const torn = state.disasters.tornado;
                if (!car.isCaughtInTornado && !car.isFalling && !car.isExploding) {
                    const dx = car.x - torn.position.x;
                    const dz = car.z - torn.position.z;
                    const dist = Math.sqrt(dx*dx + dz*dz);

                    if (dist < torn.radius) {
                        // Chance to get caught
                        if (Math.random() < 0.05) { // 5% chance per frame (high if checked every frame)
                            car.isCaughtInTornado = true;
                            car.crashed = true;
                            car.tornadoAngle = Math.atan2(dz, dx);
                        }
                    }
                }
            } else if (car.isCaughtInTornado) {
                // Tornado ended but car was caught -> release
                car.isCaughtInTornado = false;
                car.isFalling = true;
                // Fling
                car.vx = (Math.random() - 0.5) * 100;
                car.vz = (Math.random() - 0.5) * 100;
                car.vy = 20;
            }

            if (car.isCaughtInTornado) {
                const torn = state.disasters.tornado;
                // Spiral up
                car.y += 30 * dt;
                car.tornadoAngle += 5 * dt;
                const r = Math.min(torn.radius * 0.8, 10 + car.y * 0.1);

                car.x = torn.position.x + Math.cos(car.tornadoAngle) * r;
                car.z = torn.position.z + Math.sin(car.tornadoAngle) * r;

                car.vr.x += dt * 5;
                car.vr.z += dt * 5;

                // Throw if too high
                if (car.y > 200 + Math.random() * 100) {
                    car.isCaughtInTornado = false;
                    car.isFalling = true;
                    // Fling velocity
                    const angle = car.tornadoAngle + Math.PI / 2; // Tangential
                    const force = 150;
                    car.vx = Math.cos(angle) * force;
                    car.vz = Math.sin(angle) * force;
                    car.vy = 50; // Up
                }
            }

            // [CHANGE] Check for Ground Logic
            else if (!car.isFalling && !car.isExploding) {
                // Only check ground if enabled in config
                if (state.trafficConfig && state.trafficConfig.groundCheck) {
                    const key = getVoxelKey(car.x, car.z);
                    // Check if ground exists at this location.
                    if (!bridgeVoxelMap.has(key)) {
                        car.isFalling = true;
                        car.crashed = true; // Mark as crashed visually (red, etc)
                        car.velocity *= 0.8; // Maintain some forward momentum but slow down
                        // [CHANGE] Init freefall velocity from movement
                        car.vx = car.velocity * dir;
                        car.vz = 0;
                    }
                }
            }

            // Falling Logic (Generalized for free physics)
            if (car.isFalling) {
                car.y += (car.vy || 0) * dt;
                car.vy = (car.vy || 0) - 90.8 * dt; // Gravity (strong)

                // Use explicit velocities if present, else fallback to lane logic
                if (car.vx !== 0 || car.vz !== 0) {
                    car.x += car.vx * dt;
                    car.z += car.vz * dt;
                } else {
                    car.x += car.velocity * dir * dt;
                }

                // Tilt while falling
                car.vr.x += dt;

                // Impact
                if (car.y < 60) { // Bridge height is ~67
                     // Check if it hit the bridge deck (approx check) or water
                     if (car.y < -20) {
                        // Water Splash / Reset
                        car.isFalling = false;
                        car.crashed = false;
                        car.isCaughtInTornado = false;
                        car.vx = 0; car.vz = 0; car.vy = 0;
                        car.y = state.trafficConfig ? state.trafficConfig.y : 69;
                        car.velocity = 0;
                        car.acceleration = 0;
                        car.crashTimer = 0;
                        car.x = (Math.random() - 0.5) * 3000;
                     } else {
                         // Check collision with bridge if falling from high (Tornado throw)
                         // For now, if it hits water/ground plane
                         if (car.y < 20 && Math.abs(car.vy) > 50) {
                             // Explode on impact
                             car.isFalling = false;
                             car.isExploding = true;
                             car.vy = 20; // Bounce up slightly
                             spawnExplosion(car.x, car.y, car.z, 2.0);
                         }
                     }
                }
                // Skip other physics
            }
            else if (car.isExploding) {
                // Explosion Logic
                car.y += car.vy * dt;
                car.vy -= 50 * dt; // Gravity (stronger for effect)

                if (car.y < -50) {
                    // Reset / Respawn
                    car.isExploding = false;
                    car.crashed = false;
                    car.y = state.trafficConfig ? state.trafficConfig.y : 69;
                    car.velocity = 0;
                    car.acceleration = 0;
                    car.crashTimer = 0;
                }
                // return; // Skip normal physics (let the visualization block below handle it)
            }
            else {

                // [CHANGE] Check for lava destruction (only if not falling/exploding)
                if (!car.crashed && checkLavaCollision(car)) {
                    car.crashed = true;
                    car.isExploding = true;
                    car.vy = 20 + Math.random() * 20; // Blast up
                    car.vr.set(Math.random(), Math.random(), Math.random());
                    spawnExplosion(car.x, car.y, car.z);
                }

                // Sticky Crash Logic
                if (car.crashTimer > 0) {
                    car.crashTimer -= dt;
                    car.velocity = 0;
                    car.acceleration = 0;
                    car.crashed = true; // Ensure flag is set
                    // Skip physics update for this car
                } else {
                    car.crashed = false; // Recovered

                    // Find target car ahead
                    let target = null;
                    if (dir === 1) {
                        if (i < laneCars.length - 1) target = laneCars[i + 1];
                        else target = laneCars[0]; // Wrap: Leader looks at first car (which is far behind/ahead in loop)
                    } else {
                        if (i > 0) target = laneCars[i - 1];
                        else target = laneCars[laneCars.length - 1]; // Wrap
                    }

                    // Calculate Gap with Map Wrapping
                    let gap = 10000;
                    let targetVel = car.maxSpeed; // Default if no target (shouldn't happen with wrap logic)

                    if (target && target !== car) {
                        if (dir === 1) {
                            gap = target.x - car.x;
                            if (gap < 0) gap += mapWidth; // Wrapped
                        } else {
                            gap = car.x - target.x;
                            if (gap < 0) gap += mapWidth; // Wrapped
                        }
                        gap -= (target.length / 2 + car.length / 2);
                        targetVel = target.velocity;
                    }

                    // Dynamic Safe Distance (Time Headway)
                    // [CHANGE] Scale headway inversely with speed multiplier to allow faster flow
                    const timeHeadway = 1.5 / Math.max(1, speedMult * 0.8);
                    const minGap = 4.0; // meters
                    const desiredGap = minGap + car.velocity * timeHeadway;

                    // IDM-like Logic
                    const effectiveMaxSpeed = car.maxSpeed * speedMult;
                    let freeRoadAccel = car.throttleForce * speedMult * (1 - Math.pow(car.velocity / effectiveMaxSpeed, 4));

                    // Braking term
                    let brakingTerm = 0;
                    if (gap < desiredGap) {
                        // We are too close
                        const ratio = desiredGap / Math.max(0.1, gap);
                        brakingTerm = -car.brakingForce * (ratio * ratio);

                        // Dampening: If target is faster, reduce braking
                        if (targetVel > car.velocity) {
                            brakingTerm *= 0.5;
                        }

                        // Distraction (Reckless drivers might ignore braking)
                        let isDistracted = false;

                        // Sticky Distraction Check
                        if (car.distractionTimer > 0) {
                            car.distractionTimer -= dt;
                            isDistracted = true;
                        } else {
                            // Chance to start distraction
                            let startDistraction = false;
                            // Reckless drivers: Base 5% * multiplier
                            if (car.recklessness > 0.8 && Math.random() < 0.05 * crashMultiplier) {
                                startDistraction = true;
                            }
                            // Normal drivers in heavy fog: Small chance if fog > 50%
                            if (fogFactor > 0.5 && Math.random() < 0.005 * crashMultiplier) {
                                startDistraction = true;
                            }

                            if (startDistraction) {
                                car.distractionTimer = 1.0 + Math.random(); // Distracted for 1-2 seconds
                                isDistracted = true;
                            }
                        }

                        if (isDistracted) {
                            brakingTerm = 0; // Oops, didn't see you there!
                            // Aggressive Distraction: Gas it!
                            freeRoadAccel = car.throttleForce * speedMult * 3;
                        }
                    }

                    car.acceleration = freeRoadAccel + brakingTerm;

                    // Restart Logic: If stopped and gap is large, ensure positive acceleration
                    if (car.velocity < 0.5 && gap > minGap + 5) {
                        car.acceleration = Math.max(car.acceleration, 5.0 * speedMult);
                    }

                    // Collision
                    if (gap <= 0.5) { // Increased tolerance slightly
                        car.crashed = true;
                        car.crashTimer = 5.0; // Stuck for 5 seconds
                        car.velocity = 0;
                        car.acceleration = 0;

                        // EXPLOSION CHECK
                        if (speedMult > 2.0) {
                            car.isExploding = true;
                            car.vy = 10 * speedMult + Math.random() * 10; // Launch up!
                            car.vr.set(Math.random(), Math.random(), Math.random()); // Spin
                            spawnExplosion(car.x, car.y, car.z);
                        }
                    }

                    // Integration
                    car.velocity += car.acceleration * dt;
                    if (car.velocity < 0) car.velocity = 0; // No reversing
                    if (car.velocity > effectiveMaxSpeed * 1.5) car.velocity = effectiveMaxSpeed * 1.5; // Cap speed sanity check

                    car.x += car.velocity * dir * dt;

                    // Wrap Position
                    if (car.x > halfWidth) car.x -= mapWidth;
                    if (car.x < -halfWidth) car.x += mapWidth;
                }
            }

            // Visual Update
            const visible = true;
            const scale = visible ? 1 : 0;

            dummy.position.set(car.x, car.y, car.z);
            dummy.rotation.set(0, car.dir > 0 ? 0 : Math.PI, 0);

            // Reckless Wobble
            if (car.recklessness > 0.8 && !car.crashed) {
                dummy.position.x += Math.sin(Date.now() * 0.01 + car.typeIndex) * 2.0; // Increased Weaving
            }

            if (car.crashed) {
                // Visual damage
                dummy.rotation.y += 0.2; // Crooked
                dummy.rotation.z = 0.1 * car.dir; // Tilted
                dummy.position.y += 0.2; // Hop up

                if (car.isExploding || car.isFalling) {
                    dummy.rotation.x += (car.vr.x || 0.1) * Date.now() * 0.01;
                    dummy.rotation.y += (car.vr.y || 0.1) * Date.now() * 0.01;
                    dummy.rotation.z += (car.vr.z || 0.1) * Date.now() * 0.01;
                }

                // Turn RED
                state.carMeshes[car.type].body.setColorAt(car.typeIndex, new THREE.Color(0xff0000));
            } else {
                // Restore color
                state.carMeshes[car.type].body.setColorAt(car.typeIndex, car.originalColor);
            }
            state.carMeshes[car.type].body.instanceColor.needsUpdate = true;

            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            // Update the specific car mesh
            const meshes = state.carMeshes[car.type];
            meshes.body.setMatrixAt(car.typeIndex, dummy.matrix);
            meshes.windows.setMatrixAt(car.typeIndex, dummy.matrix);
            meshes.wheels.setMatrixAt(car.typeIndex, dummy.matrix);

            // Headlights/Taillights
            // Left
            dummyL.position.set(car.x + 2 * car.dir, car.y, car.z + 0.8);
            dummyL.scale.set(scale, scale, scale);
            dummyL.updateMatrix();
            state.headlightMesh.setMatrixAt(car.typeIndex * 2, dummyL.matrix);
            // Right
            dummyL.position.set(car.x + 2 * car.dir, car.y, car.z - 0.8);
            dummyL.scale.set(scale, scale, scale);
            dummyL.updateMatrix();
            state.headlightMesh.setMatrixAt(car.typeIndex * 2 + 1, dummyL.matrix);

            // Taillights
            // Left
            dummyL.position.set(car.x - 2 * car.dir, car.y, car.z + 0.8);
            dummyL.scale.set(scale, scale, scale);
            dummyL.updateMatrix();
            state.taillightMesh.setMatrixAt(car.typeIndex * 2, dummyL.matrix);
            // Right
            dummyL.position.set(car.x - 2 * car.dir, car.y, car.z - 0.8);
            dummyL.scale.set(scale, scale, scale);
            dummyL.updateMatrix();
            state.taillightMesh.setMatrixAt(car.typeIndex * 2 + 1, dummyL.matrix);
        });
    });

    // Update all meshes
    Object.values(state.carMeshes).forEach(m => {
        m.body.instanceMatrix.needsUpdate = true;
        m.windows.instanceMatrix.needsUpdate = true;
        m.wheels.instanceMatrix.needsUpdate = true;
    });
    state.headlightMesh.instanceMatrix.needsUpdate = true;
    state.taillightMesh.instanceMatrix.needsUpdate = true;
}

export function createStreetLights(scene) {
    const count = 60; // 30 per side
    const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 8, 8);
    poleGeo.translate(0, 4, 0);
    const headGeo = new THREE.BoxGeometry(1.5, 0.5, 0.8);
    headGeo.translate(0.5, 8, 0);

    const geometry = BufferGeometryUtils.mergeGeometries([poleGeo, headGeo]);
    const material = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        emissive: 0xffaa00,
        emissiveIntensity: 0
    });

    // Calculate correct count
    const spacing = 60;
    const numLights = Math.floor(2800 / spacing);

    state.lampPostMesh = new THREE.InstancedMesh(geometry, material, numLights * 2);
    state.lampPostMesh.castShadow = true;
    state.lampPostMesh.receiveShadow = true;
    scene.add(state.lampPostMesh);

    const dummy = new THREE.Object3D();
    let idx = 0;

    for (let i = 0; i <= numLights; i++) {
        const x = -1400 + i * spacing;

        // Left side (Z = 35)
        dummy.position.set(x, 68, 35);
        dummy.rotation.y = Math.PI / 2; // Face inward (towards Z=0)
        dummy.updateMatrix();
        state.lampPostMesh.setMatrixAt(idx++, dummy.matrix);

        // Right side (Z = -35)
        dummy.position.set(x, 68, -35);
        dummy.rotation.y = -Math.PI / 2; // Face inward
        dummy.updateMatrix();
        state.lampPostMesh.setMatrixAt(idx++, dummy.matrix);
    }
}

export function createParticles(scene) {
    const maxParticles = 2000;
    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    state.particleMesh = new THREE.InstancedMesh(geometry, material, maxParticles);
    scene.add(state.particleMesh);

    for (let i = 0; i < maxParticles; i++) {
        state.particleData.push({
            active: false,
            x: 0, y: 0, z: 0,
            vx: 0, vy: 0, vz: 0,
            life: 0, maxLife: 1,
            color: new THREE.Color()
        });
    }

    // [CHANGE] Expose spawnExplosion to global state for disasters
    if (!state.callbacks) state.callbacks = {};
    state.callbacks.spawnExplosion = spawnExplosion;
}

export function spawnExplosion(x, y, z, scale = 1.0) {
    const maxParticles = 2000;
    const count = Math.floor(50 * scale);
    let spawned = 0;
    for (let i = 0; i < maxParticles; i++) {
        if (spawned >= count) break;
        if (!state.particleData[i].active) {
            const p = state.particleData[i];
            p.active = true;
            p.x = x + (Math.random() - 0.5) * 5 * scale;
            p.y = y + (Math.random() - 0.5) * 5 * scale;
            p.z = z + (Math.random() - 0.5) * 5 * scale;

            // Explosion velocity
            p.vx = (Math.random() - 0.5) * 30 * scale;
            p.vy = ((Math.random() - 0.5) * 30 + 10) * scale; // Upward bias
            p.vz = (Math.random() - 0.5) * 30 * scale;

            p.life = (1.0 + Math.random()) * Math.sqrt(scale); // Lasts longer if bigger
            p.maxLife = p.life;

            // Fire colors (Red/Orange/Yellow)
            if (Math.random() > 0.5) {
                p.color.setHSL(0.05 + Math.random() * 0.1, 1, 0.5);
            } else {
                // Smoke (Grey)
                p.color.setHSL(0, 0, 0.2 + Math.random() * 0.2);
                p.vy += 10 * scale; // Smoke rises faster
                p.life += 1.0; // Smoke lasts longer
            }

            state.particleMesh.setColorAt(i, p.color);
            spawned++;
        }
    }
    state.particleMesh.instanceColor.needsUpdate = true;
}

export function updateParticles(dt) {
    if (!state.particleMesh) return;

    const maxParticles = 2000;
    let activeCount = 0;
    let needsUpload = false;

    for (let i = 0; i < maxParticles; i++) {
        const p = state.particleData[i];
        if (p.active) {
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                state.dummyParticle.scale.set(0, 0, 0);
                state.dummyParticle.updateMatrix();
                state.particleMesh.setMatrixAt(i, state.dummyParticle.matrix);
                needsUpload = true;
                continue;
            }

            // Physics
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;

            p.vy -= 9.8 * dt; // Gravity

            // Render
            state.dummyParticle.position.set(p.x, p.y, p.z);
            const scale = p.life / p.maxLife;
            state.dummyParticle.scale.set(scale, scale, scale);
            state.dummyParticle.updateMatrix();
            state.particleMesh.setMatrixAt(i, state.dummyParticle.matrix);

            activeCount++;
            needsUpload = true;
        }
    }

    if (needsUpload) {
        state.particleMesh.instanceMatrix.needsUpdate = true;
    }
}

export function createPedestrians(scene, config) {
    if (!config) return;

    const count = config.count || 50;
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    geometry.translate(0, 1, 0); // Pivot at feet
    const material = new THREE.MeshStandardMaterial({ color: 0xffaa00 });

    state.pedestrianMesh = new THREE.InstancedMesh(geometry, material, count);
    state.pedestrianMesh.castShadow = true;
    state.pedestrianMesh.receiveShadow = true;
    scene.add(state.pedestrianMesh);

    state.pedestrians = [];

    for (let i = 0; i < count; i++) {
        // Pick a random sidewalk area
        const area = config.areas[Math.floor(Math.random() * config.areas.length)];
        const x = area.x + (Math.random() - 0.5) * area.width;
        const z = area.z + (Math.random() - 0.5) * area.length;

        state.pedestrians.push({
            x, y: area.y, z,
            speed: 2 + Math.random() * 2,
            dir: Math.random() > 0.5 ? 1 : -1,
            area: area,
            color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5)
        });

        state.pedestrianMesh.setColorAt(i, state.pedestrians[i].color);
    }
}

export function updatePedestrians(dt) {
    if (!state.pedestrianMesh) return;

    const dummy = new THREE.Object3D();

    state.pedestrians.forEach((p, i) => {
        if (p.area.axis === 'x') {
            p.x += p.speed * p.dir * dt;
            // Bounds check X
            const halfLen = p.area.width / 2; // Use width as length for X-axis
            if (p.x > p.area.x + halfLen) {
                p.x = p.area.x + halfLen;
                p.dir *= -1;
            } else if (p.x < p.area.x - halfLen) {
                p.x = p.area.x - halfLen;
                p.dir *= -1;
            }
        } else {
            // Default Z axis
            p.z += p.speed * p.dir * dt;
            // Bounds check Z
            const halfLen = p.area.length / 2;
            if (p.z > p.area.z + halfLen) {
                p.z = p.area.z + halfLen;
                p.dir *= -1;
            } else if (p.z < p.area.z - halfLen) {
                p.z = p.area.z - halfLen;
                p.dir *= -1;
            }
        }

        dummy.position.set(p.x, p.y, p.z);
        // Bobbing
        dummy.position.y += Math.abs(Math.sin(Date.now() * 0.01 * p.speed + i)) * 0.2;

        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        state.pedestrianMesh.setMatrixAt(i, dummy.matrix);
    });

    state.pedestrianMesh.instanceMatrix.needsUpdate = true;
}
