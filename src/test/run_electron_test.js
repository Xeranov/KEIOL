const { spawnSync } = require('child_process');
const path = require('path');

const targetScript = process.argv[2] || 'src/test/test_desustream_electron.js';
const electronBin = path.join(__dirname, '../../node_modules/electron/dist/electron.exe');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

console.log('Running:', targetScript);
const res = spawnSync(electronBin, [path.resolve(targetScript)], {
  env,
  stdio: 'inherit'
});

process.exit(res.status || 0);
