const { system, filesystem } = require('gluegun');

const src = filesystem.path(__dirname, '..');
const { version } = require('../package.json');

const cli = async (cmd) => system.run('node ' + filesystem.path(src, 'bin', 'dine-at-disney') + ` ${cmd}`);

test('outputs version', async () => {
  const output = await cli('--version');
  expect(output).toContain(version);
});

test('outputs help', async () => {
  const output = await cli('--help');
  expect(output).toContain('dine-at-disney');
});
