const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    if (dir.includes('.git') || dir.includes('out') || dir.includes('build\\node_modules') && !dir.includes('build\\node_modules\\@vscode') && !dir.includes('build\\node_modules\\node-pty')) {
       // ignore
    }
    
    let list;
    try {
        list = fs.readdirSync(dir);
    } catch(e) { return results; }

    list.forEach(file => {
        file = path.join(dir, file);
        try {
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) { 
                if (!file.endsWith('.git')) {
                   results = results.concat(walk(file));
                }
            } else if (file.endsWith('.gyp') || file.endsWith('.gypi')) {
                results.push(file);
            }
        } catch(e) {}
    });
    return results;
}

const files = walk('.');
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.match(/['"]SpectreMitigation['"]\s*:\s*['"]Spectre['"]/)) {
        console.log('Fixing ' + f);
        content = content.replace(/['"]SpectreMitigation['"]\s*:\s*['"]Spectre['"]/g, '"SpectreMitigation": "false"');
        fs.writeFileSync(f, content, 'utf8');
    }
});
