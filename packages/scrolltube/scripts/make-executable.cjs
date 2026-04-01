const fs = require('fs');
const path = require('path');

const cliPath = path.resolve(__dirname, '../dist/cli/index.js');

if (fs.existsSync(cliPath)) {
    let content = fs.readFileSync(cliPath, 'utf8');
    if (!content.startsWith('#!/usr/bin/env node')) {
        content = '#!/usr/bin/env node\n' + content;
        fs.writeFileSync(cliPath, content);
    }
    // On Unix systems, this would make it executable. On Windows it doesn't do much but is good practice.
    try {
        fs.chmodSync(cliPath, '755');
    } catch (e) {
        // Ignore errors on systems that don't support chmod
    }
    console.log('CLI made executable.');
} else {
    console.error('CLI build not found at:', cliPath);
}
