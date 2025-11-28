const fs = require('fs');
const path = require('path');

console.log('Verifying UI changes...');

// 1. Check index.html for new elements
const htmlContent = fs.readFileSync('index.html', 'utf8');
const hasToggle = htmlContent.includes('<button id="ui-toggle">');
const hasHint = htmlContent.includes('<div id="orientation-hint">');

console.log('index.html has ui-toggle:', hasToggle);
console.log('index.html has orientation-hint:', hasHint);

if (!hasToggle || !hasHint) {
    console.error('FAILED: Missing elements in index.html');
    process.exit(1);
}

// 2. Check css/style.css for responsive styles
const cssContent = fs.readFileSync('css/style.css', 'utf8');
const hasMedia = cssContent.includes('@media (max-width: 768px)');
const hasVisibleClass = cssContent.includes('#ui-container.visible');
const hasLandscape = cssContent.includes('@media (orientation: landscape)');

console.log('css/style.css has mobile breakpoint:', hasMedia);
console.log('css/style.css has .visible class logic:', hasVisibleClass);
console.log('css/style.css has landscape adjustment:', hasLandscape);

if (!hasMedia || !hasVisibleClass || !hasLandscape) {
    console.error('FAILED: Missing CSS rules');
    process.exit(1);
}

// 3. Check js/ui.js for event listeners logic
const jsContent = fs.readFileSync('js/ui.js', 'utf8');
const hasToggleLogic = jsContent.includes('uiContainer.classList.toggle(\'visible\')');
const hasCloseLogic = jsContent.includes('uiContainer.classList.remove(\'visible\')');

console.log('js/ui.js has toggle logic:', hasToggleLogic);
console.log('js/ui.js has auto-close logic:', hasCloseLogic);

if (!hasToggleLogic || !hasCloseLogic) {
    console.error('FAILED: Missing JS logic');
    process.exit(1);
}

console.log('SUCCESS: All static checks passed.');
