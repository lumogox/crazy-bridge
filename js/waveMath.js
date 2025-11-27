import * as THREE from 'three';

// --- Shared Math for Water Simulation ---
// Must match the Vertex Shader in environment.js EXACTLY!

function fract(x) {
    return x - Math.floor(x);
}

function dot(x1, y1, x2, y2) {
    return x1 * x2 + y1 * y2;
}

function mix(x, y, a) {
    return x * (1 - a) + y * a;
}

function random(x, y) {
    return fract(Math.sin(dot(x, y, 12.9898, 78.233)) * 43758.5453123);
}

function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fract(x);
    const fy = fract(y);

    const a = random(ix, iy);
    const b = random(ix + 1.0, iy);
    const c = random(ix, iy + 1.0);
    const d = random(ix + 1.0, iy + 1.0);

    const ux = fx * fx * (3.0 - 2.0 * fx);
    const uy = fy * fy * (3.0 - 2.0 * fy);

    return mix(a, b, ux) + (c - a) * uy * (1.0 - ux) + (d - b) * ux * uy;
}

export function getWaterHeight(x, z, time, windSpeed) {
    const waveAmp = 1.0 + windSpeed * 0.5;
    const waveFreq = 1.0 + windSpeed * 0.2;

    // Shader:
    // float wave1 = sin(pos.x * 0.01 * waveFreq + time * waveFreq) * 2.0 * waveAmp;
    // float wave2 = cos(pos.z * 0.01 * waveFreq + time * 0.8 * waveFreq) * 2.0 * waveAmp;
    // float wave3 = noise(pos.xz * 0.02 + time * waveFreq) * 3.0 * waveAmp;

    const wave1 = Math.sin(x * 0.01 * waveFreq + time * waveFreq) * 2.0 * waveAmp;
    const wave2 = Math.cos(z * 0.01 * waveFreq + time * 0.8 * waveFreq) * 2.0 * waveAmp;

    // Noise input scaling
    const nx = x * 0.02 + time * waveFreq; // Note: Shader adds time to noise coord? 
    // Wait, shader says: noise(pos.xz * 0.02 + time * waveFreq)
    // This adds a scalar to a vector? No, GLSL is weird or I misread.
    // Let's re-read shader: noise(pos.xz * 0.02 + time * waveFreq)
    // If pos.xz is vec2, and time*waveFreq is float, GLSL adds float to both components.
    const nz = z * 0.02 + time * waveFreq;

    const wave3 = noise(nx, nz) * 3.0 * waveAmp;

    return wave1 + wave2 + wave3;
}

export function getWaterNormal(x, z, time, windSpeed) {
    const H = getWaterHeight(x, z, time, windSpeed);
    const Hx = getWaterHeight(x + 1.0, z, time, windSpeed);
    const Hz = getWaterHeight(x, z + 1.0, time, windSpeed);

    const dx = Hx - H;
    const dz = Hz - H;

    // Tangent vectors: T1 = (1, dx, 0), T2 = (0, dz, 1)
    // Normal = T2 x T1 = (dz, 1, -dx) ... wait, order matters.
    // Let's do standard cross product of (1, dx, 0) and (0, dz, 1)
    // (1, dx, 0) x (0, dz, 1)
    // x: dx*1 - 0*dz = dx
    // y: 0*0 - 1*1 = -1
    // z: 1*dz - dx*0 = dz
    // Vector is (dx, -1, dz). We want Up to be positive Y.
    // So Cross (0, dz, 1) x (1, dx, 0) -> (-dz, 1, -dx) ? 

    // Let's just use the slope.
    // Normal is roughly (-dh/dx, 1, -dh/dz).

    const normal = new THREE.Vector3(-dx, 1.0, -dz);
    normal.normalize();
    return normal;
}
