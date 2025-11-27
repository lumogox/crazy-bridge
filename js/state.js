import * as THREE from 'three';

export const params = {
    time: 12,
    fogDensity: 20,
    trafficDensity: 50,
    zoom: 50,
    speedMultiplier: 1.0
};

export const colors = {
    dawn: { sky: new THREE.Color(0xffaa55), fog: new THREE.Color(0xffaa55), sun: new THREE.Color(0xffaa00), ambient: new THREE.Color(0x886644), hemi: new THREE.Color(0xffaa55) },
    noon: { sky: new THREE.Color(0x87CEEB), fog: new THREE.Color(0x87CEEB), sun: new THREE.Color(0xffffff), ambient: new THREE.Color(0x404040), hemi: new THREE.Color(0xffffbb) },
    dusk: { sky: new THREE.Color(0xcc6666), fog: new THREE.Color(0xcc6666), sun: new THREE.Color(0xff4500), ambient: new THREE.Color(0x664433), hemi: new THREE.Color(0xcc6666) },
    night: { sky: new THREE.Color(0x000011), fog: new THREE.Color(0x000011), sun: new THREE.Color(0x000000), ambient: new THREE.Color(0x050510), hemi: new THREE.Color(0x000011) }
};

export const state = {
    trafficData: [],
    carMeshes: {},
    ships: [],
    birds: [],
    particleData: [],
    towerBeacons: [],
    cityMaterial: null,
    water: null,
    fogSystem: null,
    fogUniforms: null,
    sunLight: null,
    ambientLight: null,
    hemisphereLight: null,
    headlightMesh: null,
    taillightMesh: null,
    particleMesh: null,
    dummyParticle: new THREE.Object3D(),
    birdMesh: null,
    cloudMesh: null,
    clouds: []
};
