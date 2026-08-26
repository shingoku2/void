const fs = require('fs');
const path = require('path');
const glob = require('glob'); // Note: we can use a simple recursive function instead.

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('binding.gyp')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('node_modules').concat(walk('remote/node_modules'));
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes("'SpectreMitigation': 'Spectre'")) {
        console.log('Fixing ' + f);
        content = content.replace(/'SpectreMitigation': 'Spectre'/g, "'SpectreMitigation': 'false'");
        fs.writeFileSync(f, content, 'utf8');
    }
});
