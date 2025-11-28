import { config } from './appState.js';
import { updateTimeOfDay } from './scene.js';
import { updateFog } from './environment.js';
// [CHANGE] Import trigger function
import { triggerVolcano } from './disasters.js';

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

    // Season Slider
    let seasonSlider = document.getElementById('seasonSlider');
    if (!seasonSlider) {
        const container = document.getElementById('ui-container');
        const div = document.createElement('div');
        div.className = 'control-group';
        div.innerHTML = `
            <label>Season <span id="seasonValue" class="value-display">Summer</span></label>
            <input type="range" id="seasonSlider" min="0" max="1" step="0.01" value="0">
        `;
        container.appendChild(div);
        seasonSlider = document.getElementById('seasonSlider');
    }

    // Precipitation Slider
    let precipSlider = document.getElementById('precipSlider');
    if (!precipSlider) {
        const container = document.getElementById('ui-container');
        const div = document.createElement('div');
        div.className = 'control-group';
        div.innerHTML = `
            <label>Precipitation <span id="precipValue" class="value-display">0%</span></label>
            <input type="range" id="precipSlider" min="0" max="100" step="1" value="0">
        `;
        container.appendChild(div);
        precipSlider = document.getElementById('precipSlider');
    }

    // Wind Slider
    let windSlider = document.getElementById('windSlider');
    if (!windSlider) {
        const container = document.getElementById('ui-container');
        const div = document.createElement('div');
        div.className = 'control-group';
        div.innerHTML = `
            <label>Wind Strength <span id="windValue" class="value-display">1.0</span></label>
            <input type="range" id="windSlider" min="0" max="10" step="0.1" value="1">
        `;
        container.appendChild(div);
        windSlider = document.getElementById('windSlider');
    }

    // [CHANGE] Disaster Controls
    let disasterDiv = document.getElementById('disaster-controls');
    if (!disasterDiv) {
        const container = document.getElementById('ui-container');
        disasterDiv = document.createElement('div');
        disasterDiv.id = 'disaster-controls';
        disasterDiv.className = 'control-group';
        disasterDiv.style.marginTop = '20px';
        disasterDiv.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        disasterDiv.style.paddingTop = '10px';

        disasterDiv.innerHTML = `
            <label style="color: #ff4444; margin-bottom: 10px;">Disasters</label>
            <div style="display: flex; gap: 10px;">
                <button id="btnVolcano" style="flex: 1; padding: 8px; background: #552222; color: white; border: 1px solid #ff4444; border-radius: 4px; cursor: pointer; font-weight: bold;">🌋 Erupt</button>
            </div>
        `;
        container.appendChild(disasterDiv);

        // Add Listener
        document.getElementById('btnVolcano').addEventListener('click', () => {
            triggerVolcano();
        });
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

    addValueDisplay('timeSlider', 'timeValue', config.time);
    addValueDisplay('fogSlider', 'fogValue', config.fogDensity);
    addValueDisplay('trafficSlider', 'trafficValue', config.trafficDensity * 100);
    addValueDisplay('zoomSlider', 'zoomValue', config.zoom);

    timeSlider.addEventListener('input', (e) => {
        config.time = parseFloat(e.target.value);
        document.getElementById('timeValue').textContent = config.time.toFixed(1);
        updateTimeOfDay(scene);
    });

    fogSlider.addEventListener('input', (e) => {
        config.fogDensity = parseFloat(e.target.value);
        document.getElementById('fogValue').textContent = config.fogDensity;
        updateFog(scene);
    });

    trafficSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        config.trafficDensity = val / 100;
        document.getElementById('trafficValue').textContent = val;
    });

    zoomSlider.addEventListener('input', (e) => {
        config.zoom = parseFloat(e.target.value);
        document.getElementById('zoomValue').textContent = config.zoom;
        camera.fov = 60 * (100 / config.zoom);
        camera.updateProjectionMatrix();
    });

    speedSlider.addEventListener('input', (e) => {
        config.speedMultiplier = parseFloat(e.target.value);
        document.getElementById('speedValue').textContent = config.speedMultiplier.toFixed(1);
    });

    seasonSlider.addEventListener('input', (e) => {
        config.season = parseFloat(e.target.value);
        const val = config.season;
        let text = "Summer";
        if (val > 0.25) text = "Autumn";
        if (val > 0.75) text = "Winter";
        document.getElementById('seasonValue').textContent = text;
    });

    precipSlider.addEventListener('input', (e) => {
        config.weatherIntensity = parseFloat(e.target.value) / 100;
        document.getElementById('precipValue').textContent = Math.round(config.weatherIntensity * 100) + "%";
    });

    windSlider.addEventListener('input', (e) => {
        config.windSpeed = parseFloat(e.target.value);
        document.getElementById('windValue').textContent = config.windSpeed.toFixed(1);
    });

    // Mobile UI Toggle Logic
    const uiToggle = document.getElementById('ui-toggle');
    const uiContainer = document.getElementById('ui-container');

    if (uiToggle && uiContainer) {
        uiToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the close listener
            uiContainer.classList.toggle('visible');
        });

        // Close UI when clicking outside
        document.addEventListener('click', (e) => {
            // Only apply this logic if the UI is currently open/visible (mostly relevant for mobile)
            if (uiContainer.classList.contains('visible')) {
                // Check if the click was outside the UI container and outside the toggle button
                if (!uiContainer.contains(e.target) && e.target !== uiToggle) {
                    uiContainer.classList.remove('visible');
                }
            }
        });

        // Prevent clicks inside the UI from closing it
        uiContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}
