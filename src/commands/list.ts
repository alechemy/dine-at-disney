import { GluegunCommand, GluegunToolbox } from 'gluegun';

module.exports = {
  name: 'list',
  run: async (toolbox: GluegunToolbox) => {
    const {
      parameters: { options },
      print,
      disneyApi,
    } = toolbox;

    const { resort = 'dlr' } = options;

    if (resort !== 'dlr' && resort !== 'wdw') {
      print.error('resort must be either "dlr" or "wdw".');
      return;
    }

    await disneyApi.listPlaces({ print, resort });
  },
} as GluegunCommand;
