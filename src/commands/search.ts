import { GluegunCommand, GluegunToolbox } from 'gluegun';
import { mail } from '../lib/mail';

module.exports = {
  name: 'search',
  run: async (toolbox: GluegunToolbox) => {
    const { parameters, print, disneyApi } = toolbox;
    const date = parameters.first;

    const onSuccess = (foundTables) => {
      console.log('Found a table!');
      console.log(foundTables);
      mail('Be our guest!', JSON.stringify(foundTables));
    };

    print.info(`Checking for tables on ${date}...`);
    disneyApi.checkTables(date, onSuccess);
  },
} as GluegunCommand;
