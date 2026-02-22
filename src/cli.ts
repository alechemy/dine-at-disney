const { build } = require('gluegun');

// Load .env vars (Node >= 20.12 built-in)
const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

/**
 * Create the cli and kick it off
 */
async function run(argv) {
  // create a CLI runtime
  const cli = build()
    .brand('dine-at-disney')
    .src(__dirname)
    .plugins('./node_modules', { matching: 'dine-at-disney-*', hidden: true })
    .help() // provides default for help, h, --help, -h
    .version() // provides default for version, v, --version, -v
    .create();
  // enable the following method if you'd like to skip loading one of these core extensions
  // this can improve performance if they're not necessary for your project:
  // .exclude(['meta', 'strings', 'print', 'filesystem', 'semver', 'system', 'prompt', 'http', 'template', 'patching', 'package-manager'])
  // and run it
  const toolbox = await cli.run(argv.slice(2));

  // send it back (for testing, mostly)
  return toolbox;
}

module.exports = { run };
