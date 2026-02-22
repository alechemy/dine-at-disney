import { GluegunCommand, GluegunToolbox } from 'gluegun';

module.exports = {
  name: 'list',
  run: async (toolbox: GluegunToolbox) => {
    const { print, disneyApi } = toolbox;
    await disneyApi.listPlaces({ print });
  },
} as GluegunCommand;
