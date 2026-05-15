import fs from 'fs';

fs.rmSync('.next/standalone', {recursive: true, force: true});
