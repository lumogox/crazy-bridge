# Crazy Bridge Improvement Plan

This plan outlines a phased approach to enhancing the crazy-bridge repository, focusing on structural physics, user interaction, audio immersion, and UI modernization.

## Phase 1: Structural Integrity (Floating Voxel Physics)

Goal: Currently, destroying a bridge section leaves floating voxels. We will implement a structural integrity check so that disconnected chunks fall into the ocean.

- [ ] **Core Logic (BFS/Graph)**
    - [ ] Create `js/physics/StructuralIntegrity.js`.
    - [ ] Implement `checkStructuralIntegrity` using BFS to find connected components.
    - [ ] Define anchor points (Towers at x=±640, Ends at x=±1400).
- [ ] **Debris System**
    - [ ] Implement `detachCluster` to convert static voxels to dynamic objects.
    - [ ] Create a physics update loop for falling debris (gravity, rotation).
    - [ ] Handle cleanup when debris hits water.
- [ ] **Integration**
    - [ ] Hook into `removeVoxelAt` in `js/bridge.js`.
    - [ ] Add debris update loop to `main.js`.

## Phase 2: "God Hand" Interaction (Raycasting)

Goal: Move away from UI-only disaster triggers. Allow the user to interact directly with the 3D world using the mouse to spawn explosions or drag disasters.

- [ ] **Raycaster Setup**
    - [ ] Map mouse coordinates to 3D space in `js/interaction.js`.
    - [ ] Create event listeners for mousedown/mousemove.
- [ ] **Interactions**
    - [ ] Implement "God Smite" (Explosion on click).
    - [ ] Implement "Drag" (optional: apply force to cars/objects).
- [ ] **Visual Feedback**
    - [ ] Add cursor highlight on the grid.

## Phase 3: Immersive Audio System

Goal: Add auditory feedback. The simulation is currently silent.

- [ ] **Audio Setup**
    - [ ] Add `THREE.AudioListener` to the camera.
    - [ ] Create `js/audio.js` manager.
- [ ] **Sound Effects**
    - [ ] Add positional audio for explosions.
    - [ ] Add ambient sounds (wind, ocean).
    - [ ] Add vehicle sounds (engine, honks).

## Phase 4: Modern Glassmorphism UI

Goal: Replace the standard CSS sliders with a modern, translucent "Control Center" and a "Disaster Wheel".

- [ ] **Styling**
    - [ ] Create `css/modern-ui.css` with glassmorphism variables.
    - [ ] Apply dark theme and backdrop filters.
- [ ] **Components**
    - [ ] Create a HUD overlay for stats.
    - [ ] specific icons for disasters (Volcano, Tornado, etc.).
    - [ ] Animated transitions for UI panels.
