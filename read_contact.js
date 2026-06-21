import fs from 'fs';
const contents = fs.readFileSync('src/lib/defaultComponents.ts', 'utf8');
const searchString = 'export const DEFAULT_CONTACTLIST_SOURCE = ';
const startIndex = contents.indexOf(searchString);
if (startIndex === -1) {
    console.error("not found");
    process.exit(1);
}
let endIndex = contents.indexOf('}`;', startIndex);
if (endIndex === -1) {
    console.error("end not found");
    process.exit(1);
}
endIndex += 3;
console.log(contents.substring(startIndex, endIndex));
