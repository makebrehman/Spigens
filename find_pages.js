const fs = require('fs');
const glob = require('glob'); // maybe not exist, let's just use fs
function crawl(dir) {
    let results = [];
    let list = fs.readdirSync(dir);
    list.forEach(function(file) {
        if (file === 'node_modules' || file === '.next' || file === '.git') return;
        file = dir + '/' + file;
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (file.endsWith('/pages')) console.log("FOUND PAGES:", file);
            results = results.concat(crawl(file));
        } else {
            results.push(file);
        }
    });
    return results;
}
crawl('.');
