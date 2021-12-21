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

    const defaultDate = new Date();
    const year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(defaultDate);
    const month = new Intl.DateTimeFormat('en', { month: 'numeric' }).format(defaultDate);
    const day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(defaultDate);

    const { date = `${year}-${month}-${day}`, ids, party = 2 } = options;

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
      });
    } else {
      disneyApi.checkTables({ date, onSuccess, print, partySize: party });
    }
  },
} as GluegunCommand;
