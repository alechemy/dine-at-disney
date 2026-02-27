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

    const validOptions = new Set(['date', 'ids', 'party', 'show-browser', 'startTime', 'endTime']);
    const invalidOptions = Object.keys(options).filter((key) => !validOptions.has(key));
    if (invalidOptions.length > 0) {
      print.error(`Invalid option(s): ${invalidOptions.map((o) => `--${o}`).join(', ')}`);
      return;
    }

    const {
      date = new Date().toLocaleDateString('en-CA'),
      ids,
      party = 2,
      'show-browser': showBrowser = false,
      startTime,
      endTime,
    } = options;

    if (party < 1) {
      print.error('Party size must be at least 1.');
      return;
    }

    const today = new Date().toLocaleDateString('en-CA');
    if (date < today) {
      print.error('Date must not be in the past.');
      return;
    }

    const timeRegex = /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i;
    if (startTime && !timeRegex.test(String(startTime))) {
      print.error('startTime must be a valid time (e.g. "08:00" or "8:00 AM").');
      return;
    }
    if (endTime && !timeRegex.test(String(endTime))) {
      print.error('endTime must be a valid time (e.g. "13:00" or "1:00 PM").');
      return;
    }

    if (startTime && endTime) {
      const parseTime = (timeStr: string) => {
        const match = timeStr.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
        if (!match) return -1;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      if (parseTime(String(startTime)) > parseTime(String(endTime))) {
        print.error('startTime must be before or equal to endTime.');
        return;
      }
    }

    //Hooks
    const onSuccess = async ({ diningAvailability }: { diningAvailability: DiningAvailability }) =>
      Promise.allSettled([
        mail({ diningAvailability, print, partySize: party, date }),
        pushover({ diningAvailability, print, partySize: party, date }),
      ]);

    const finalStartTime = startTime ? String(startTime) : undefined;
    const finalEndTime = endTime ? String(endTime) : undefined;

    if (ids) {
      disneyApi.checkTables({
        date,
        onSuccess,
        print,
        ids: (typeof ids === 'number' ? ids.toString() : ids).split(','),
        partySize: party,
        showBrowser,
        startTime: finalStartTime,
        endTime: finalEndTime,
      });
    } else {
      disneyApi.checkTables({
        date,
        onSuccess,
        print,
        partySize: party,
        showBrowser,
        startTime: finalStartTime,
        endTime: finalEndTime,
      });
    }
  },
} as GluegunCommand;
