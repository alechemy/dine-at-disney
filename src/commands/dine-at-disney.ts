import { GluegunCommand, GluegunToolbox } from 'gluegun';

module.exports = {
  name: 'dine-at-disney',
  run: async (toolbox: GluegunToolbox) => {
    const { print } = toolbox;

    print.printHelp(toolbox);
  },
} as GluegunCommand;
