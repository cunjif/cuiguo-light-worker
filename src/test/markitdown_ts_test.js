import { markitdown } from '@lprhodes/markitdown-ts';
import { createFsReader } from '@lprhodes/markitdown-ts/node';

const result = await markitdown('C:\\Users\\james\\Desktop\\skillopt.pdf', {
    nodeServices: { readFile: createFsReader() },
});

console.log(result.markdown);