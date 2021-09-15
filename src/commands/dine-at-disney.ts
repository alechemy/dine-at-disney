import { GluegunCommand, GluegunToolbox } from 'gluegun';

module.exports = {
  name: 'dine-at-disney',
  run: async (toolbox: GluegunToolbox) => {
    const { print } = toolbox;

    print.info('Woof!');
  },
} as GluegunCommand;
