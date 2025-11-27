import { params } from './state.js';
import { updateTimeOfDay } from './scene.js';
import { updateFog } from './environment.js';

export function setupUI(scene, camera) {
    const timeSlider = document.getElementById('timeSlider');
    const fogSlider = document.getElementById('fogSlider');
    const trafficSlider = document.getElementById('trafficSlider');
    const zoomSlider = document.getElementById('zoomSlider');

    // Create Speed Slider dynamically if not exists
    let speedSlider = document.getElementById('speedSlider');
    if (!speedSlider) {
        const container = document.getElementById('ui-container');
        const div = document.createElement('div');
        div.className = 'control-group';
        div.innerHTML = `
            <label>Traffic Speed <span id="speedValue" class="value-display">1.0</span></label>
            <input type="range" id="speedSlider" min="1" max="5" step="0.1" value="1">
        `;
        container.appendChild(div);
        speedSlider = document.getElementById('speedSlider');
    }

    // Add value displays to other sliders
    function addValueDisplay(sliderId, valueId, initialValue) {
        const slider = document.getElementById(sliderId);
        const label = slider.previousElementSibling;
        if (!label.querySelector('.value-display')) {
            const span = document.createElement('span');
            span.id = valueId;
            span.className = 'value-display';
            span.textContent = initialValue;
            label.appendChild(span);
        }
    }

    addValueDisplay('timeSlider', 'timeValue', params.time);
    addValueDisplay('fogSlider', 'fogValue', params.fogDensity);
    addValueDisplay('trafficSlider', 'trafficValue', params.trafficDensity * 100);
    addValueDisplay('zoomSlider', 'zoomValue', params.zoom);

    timeSlider.addEventListener('input', (e) => {
        params.time = parseFloat(e.target.value);
        document.getElementById('timeValue').textContent = params.time.toFixed(1);
        updateTimeOfDay(scene);
    });

    fogSlider.addEventListener('input', (e) => {
        params.fogDensity = parseFloat(e.target.value);
        document.getElementById('fogValue').textContent = params.fogDensity;
        updateFog(scene);
    });

    trafficSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        params.trafficDensity = val / 100;
        document.getElementById('trafficValue').textContent = val;
    });

    zoomSlider.addEventListener('input', (e) => {
        params.zoom = parseFloat(e.target.value);
        document.getElementById('zoomValue').textContent = params.zoom;
        camera.fov = 60 * (100 / params.zoom);
        camera.updateProjectionMatrix();
    });

    speedSlider.addEventListener('input', (e) => {
        params.speedMultiplier = parseFloat(e.target.value);
        document.getElementById('speedValue').textContent = params.speedMultiplier.toFixed(1);
    });
}
