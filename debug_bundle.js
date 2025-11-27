const fs = require('fs');
try {
    const content = fs.readFileSync('dist/index.html', 'utf8');
    const index = content.indexOf('Config loaded');
    if (index === -1) {
        console.log("String 'Config loaded' not found in dist/index.html");
    } else {
        console.log("Found 'Config loaded' at index", index);
        console.log("Context before:");
        console.log(content.substring(index - 200, index));
        console.log("Context after:");
        console.log(content.substring(index, index + 100));
    }
} catch (e) {
    console.error(e);
}
