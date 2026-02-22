import { GluegunCommand, GluegunToolbox } from 'gluegun';
import mail from '../hooks/mail';
import pushover from '../hooks/pushover';
import { DiningAvailability } from '../disney-api/model/response';

module.exports = {
  name: 'search',
  run: async (toolbox: GluegunToolbox) => {
    const {
      parameters: { options },
      print,
      disneyApi,
    } = toolbox;

    const { date = new Date().toLocaleDateString('en-CA'), ids, party = 2, 'show-browser': showBrowser = false } = options;

    if (party < 1) {
      print.error('Party size must be at least 1.');
      return;
    }

    const today = new Date().toLocaleDateString('en-CA');
    if (date < today) {
      print.error('Date must not be in the past.');
      return;
    }

    //Hooks
    const onSuccess = async ({ diningAvailability }: { diningAvailability: DiningAvailability }) =>
      Promise.allSettled([
        mail({ diningAvailability, print, partySize: party, date }),
        pushover({ diningAvailability, print, partySize: party, date }),
      ]);

    if (ids) {
      disneyApi.checkTables({
        date,
        onSuccess,
        print,
        ids: (typeof ids === 'number' ? ids.toString() : ids).split(','),
        partySize: party,
        showBrowser,
      });
    } else {
      disneyApi.checkTables({ date, onSuccess, print, partySize: party, showBrowser });
    }
  },
} as GluegunCommand;
