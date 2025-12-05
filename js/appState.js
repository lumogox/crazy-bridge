import * as THREE from 'three';

console.log("State module loaded");

export let config = {
    time: 13,
    fogDensity: 2,
    trafficDensity: 0.5,
    zoom: 50,
    speedMultiplier: 1.0,
    season: 0.0, // 0 = Summer, 1 = Winter
    weatherIntensity: 0.0, // 0 = Clear, 1 = Storm
    windSpeed: 1.0,
    windSpeed: 1.0,
    windDirection: new THREE.Vector3(1, 0, 0.5).normalize(),
    // Sky Parameters
    turbidity: 10,
    rayleigh: 2,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    elevation: 2,
    azimuth: 180,
    // Water Parameters
    waterDistortionScale: 3.7,
    waterColor: 0x001e0f,
    sunColor: 0xffffff
};

window.config = config;
console.log("Config loaded:", config);

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
    clouds: [],
    precipitationSystem: null,
    precipitationData: [],
    // New Disaster State
    disasters: {
        volcano: {
            active: false,
            erupting: false,
            mesh: null,
            particles: [],
            height: 0
        },
        meteors: {
            active: false,
            particles: []
        },
        tornado: {
            active: false,
            mesh: null,
            particleMesh: null,
            particles: [],
            path: [],
            pathProgress: 0,
            position: new THREE.Vector3(),
            radius: 60,
            liftedCars: [] // IDs or references to cars
        }
    }
};
