import { GluegunCommand, GluegunToolbox } from 'gluegun';

module.exports = {
  name: 'list',
  run: async (toolbox: GluegunToolbox) => {
    const { print, disneyApi } = toolbox;
    disneyApi.listPlaces({ print });
  },
} as GluegunCommand;
