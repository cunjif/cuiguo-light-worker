import { markitdown } from '../vendor/markitdown-ts/index.js';
import { createFsReader } from '../vendor/markitdown-ts/node.js';

const result = await markitdown('C:\\Users\\james\\Desktop\\skillopt.pdf', {
    nodeServices: { readFile: createFsReader() },
});

console.log(result.markdown);