import { GluegunToolbox, GluegunPrint } from 'gluegun';
import { AvailabilityApiResponse } from '../disney-api/model/response';
import { PlaywrightManager, Resort } from '../disney-api/playwright-utils';
import { RESORT_CONFIG, getPlacesUrl } from '../disney-api/resort-config';
import { parseAvailability, summarizeTimes } from '../disney-api/parse';

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

const playwrightManager = new PlaywrightManager();

module.exports = (toolbox: GluegunToolbox) => {
  async function checkTables({
    date,
    onSuccess,
    numTries = 1,
    partySize = 2,
    tables = [],
    print,
    ids,
    showBrowser = false,
    startTime,
    endTime,
    resort = 'dlr',
  }: {
    date: string;
    onSuccess: Function;
    numTries?: number;
    partySize?: number;
    tables?: string[];
    print: GluegunPrint;
    ids?: string[];
    showBrowser?: boolean;
    startTime?: string;
    endTime?: string;
    resort?: Resort;
  }): Promise<any> {
    if (numTries === 1) {
      await playwrightManager.init(print, { showBrowser, resort });

      let timeSuffix = '';
      if (startTime && endTime) {
        timeSuffix = ` between ${startTime} and ${endTime}`;
      } else if (startTime) {
        timeSuffix = ` from ${startTime} onwards`;
      } else if (endTime) {
        timeSuffix = ` up until ${endTime}`;
      }

      if (ids && ids.length > 0) {
        print.success(`Checking for tables for ${partySize} people on ${date}${timeSuffix} for IDs: ${ids.join(', ')}...`);
      } else {
        print.success(`Checking for tables for ${partySize} people on ${date}${timeSuffix}...`);
      }
    }

    // First attempt: interact with the UI to set params and trigger search
    // Subsequent attempts: just re-click search (params are already set)
    const data = numTries === 1
      ? await playwrightManager.searchAvailability(partySize, date, print)
      : await playwrightManager.retriggerSearch(partySize, date, print);

    if (!data) {
      if (numTries === 1) {
        print.error('Failed to fetch availability data. Your session may have expired.');
        print.info(`Delete ${RESORT_CONFIG[resort].authFile} and run again to re-authenticate.`);
        await playwrightManager.close();
        process.exit(-1);
      } else {
        print.warning(`API error on attempt ${numTries}. Retrying in 60s...`);
      }

      setTimeout(() => {
        checkTables({ date, onSuccess, numTries: numTries + 1, partySize, tables, print, ids, showBrowser, startTime, endTime, resort });
      }, 60000);
      return;
    }

    const hasOffers = parseAvailability(data as AvailabilityApiResponse, date, startTime, endTime);
    const restaurantIds = Object.keys(hasOffers);

    if (restaurantIds.length === 0) {
      print.warning(`No offers found for anything. Checking again in 60s. ${numTries} total attempts.`);
      setTimeout(() => {
        checkTables({ date, onSuccess, numTries: numTries + 1, partySize, tables, print, ids, showBrowser, startTime, endTime, resort });
      }, 60000);
    } else {
      if (ids) {
        try {
          for (const id of ids) {
            if (restaurantIds.includes(id)) {
              const avail = hasOffers[id];
              const byMealPeriod = new Map<string, string[]>();
              for (const t of avail.cleanedTimes) {
                const times = byMealPeriod.get(t.mealPeriod) || [];
                times.push(t.time);
                byMealPeriod.set(t.mealPeriod, times);
              }
              const reservationUrl = `${RESORT_CONFIG[resort].baseUrl}/dine-res/restaurant/${id}`;
              if (byMealPeriod.size <= 1) {
                print.success(
                  `🎉 Found offers at ${avail.cleanedTimes.map((t) => t.time).join(', ')} for ${avail.restaurant.name}!`
                );
              } else {
                print.success(`🎉 Found offers for ${avail.restaurant.name}!`);
                for (const [period, times] of byMealPeriod) {
                  print.success(`  ${period}: ${times.join(', ')}`);
                }
              }
              print.success(`   👉 Book now: ${reservationUrl}`);
              await onSuccess({ diningAvailability: avail });
            } else {
              print.warning(`No offers found for restaurant ID ${id}.`);
            }
          }
        } catch (err) {
          print.error(err);
        }

        print.info(`Checking again in 60s. ${numTries} total attempts.`);
        setTimeout(() => {
          checkTables({ date, onSuccess, numTries: numTries + 1, partySize, tables, print, ids, showBrowser, startTime, endTime, resort });
        }, 60000);
      } else {
        const { table } = print;
        print.success(`Found some offers on ${date}:`);

        const sorted = Object.entries(hasOffers).sort(([, a], [, b]) =>
          a.restaurant.name.localeCompare(b.restaurant.name)
        );

        table(
          [
            ['Name', 'ID', 'Available Times'],
            ...sorted.map(([id, avail]) => [avail.restaurant.name, id, summarizeTimes(avail.cleanedTimes)]),
          ],
          {
            format: 'markdown',
          }
        );

        print.info('Run again with --ids <id> to poll for openings at a specific restaurant.');
        await playwrightManager.close();
        process.exit(0);
      }
    }
  }

  async function listPlaces({ print, resort = 'dlr' }: { print: GluegunPrint; resort?: Resort }): Promise<any> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const date = targetDate.toLocaleDateString('en-CA');

    print.info('Fetching restaurant list...');

    let data: any;
    try {
      data = await fetchJson(getPlacesUrl(resort, date));
    } catch (e: any) {
      print.error(`Failed to retrieve the list of restaurants: ${e?.message}`);
      process.exit(-1);
    }

    const results: any[] = data?.results || [];
    const reservable = results.filter((r) =>
      (r.facets?.tableService || []).includes('reservations-accepted')
    );

    const { table } = print;
    table(
      [
        ['Name', 'ID', 'Location'],
        ...reservable
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => {
            const loc = r.locationName || '';
            return [r.name, String(r.facilityId), loc.startsWith('finder.') ? 'Multiple Locations' : loc];
          }),
      ],
      {
        format: 'markdown',
      }
    );
  }

  toolbox.disneyApi = { checkTables, listPlaces };
};
