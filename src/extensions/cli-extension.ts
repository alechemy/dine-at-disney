import { GluegunToolbox, GluegunPrint } from 'gluegun';
import {
  AvailabilityApiResponse,
  CleanedTime,
  DiningAvailabilities,
  MealPeriodOffer,
  Restaurant,
} from '../disney-api/model/response';
import { PlaywrightManager } from '../disney-api/playwright-utils';

const BASE_URL = 'https://disneyland.disney.go.com';
const PLACES_URL = (date: string) =>
  `${BASE_URL}/finder/api/v1/explorer-service/list-ancestor-entities/dlr/80008297;entityType=destination/${date}/dining`;

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

function extractCleanedTimes(
  dateOffers: MealPeriodOffer[],
  date: string,
  useMealPeriodName = false,
): CleanedTime[] {
  return dateOffers.flatMap((mealPeriod) =>
    (mealPeriod.offersByAccessibility || []).flatMap((access) =>
      (access.offers || []).map((offer) => ({
        date,
        time: offer.label,
        label: offer.label,
        mealPeriod: useMealPeriodName ? mealPeriod.mealPeriodName : mealPeriod.mealPeriodType,
        offerId: offer.offerId,
      }))
    )
  );
}

/**
 * Parse the dine-res availability API response into our internal format.
 * Handles both regular restaurants and dining events (e.g. World of Color Dining Package).
 */
function parseAvailability(data: AvailabilityApiResponse, date: string): DiningAvailabilities {
  const result: DiningAvailabilities = {};

  // Regular restaurants
  if (data?.restaurant) {
    for (const [id, restaurant] of Object.entries(data.restaurant)) {
      const dateOffers = restaurant.offers?.[date];
      if (!dateOffers || dateOffers.length === 0) continue;

      const cleanedTimes = extractCleanedTimes(dateOffers, date);
      if (cleanedTimes.length === 0) continue;

      result[id] = { restaurant, cleanedTimes };
    }
  }

  // Dining events (e.g. World of Color Dining Package) — these nest restaurants
  // inside eventTimes[]. We key the result by dining event ID so --ids matching works,
  // and flatten all offers from all sub-restaurants into one entry.
  if (data?.diningEvent) {
    for (const [eventId, event] of Object.entries(data.diningEvent)) {
      const allCleanedTimes: CleanedTime[] = [];
      let firstRestaurant: Restaurant | null = null;

      for (const eventTime of event.eventTimes || []) {
        for (const restaurant of Object.values(eventTime.restaurant || {})) {
          if (!firstRestaurant) firstRestaurant = restaurant;
          const dateOffers = restaurant.offers?.[date];
          if (!dateOffers || dateOffers.length === 0) continue;
          allCleanedTimes.push(...extractCleanedTimes(dateOffers, date, true));
        }
      }

      if (allCleanedTimes.length === 0 || !firstRestaurant) continue;

      // Use the dining event name but the first sub-restaurant's details for display
      const eventIdNum = eventId.split(';')[0];
      result[eventIdNum] = {
        restaurant: { ...firstRestaurant, name: event.name },
        cleanedTimes: allCleanedTimes,
      };
    }
  }

  return result;
}

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
  }: {
    date: string;
    onSuccess: Function;
    numTries?: number;
    partySize?: number;
    tables?: string[];
    print: GluegunPrint;
    ids?: string[];
    showBrowser?: boolean;
  }): Promise<any> {
    if (numTries === 1) {
      await playwrightManager.init(print, { showBrowser });

      if (ids && ids.length > 0) {
        print.success(`Checking for tables for ${partySize} people on ${date} for IDs: ${ids.join(', ')}...`);
      } else {
        print.success(`Checking for tables for ${partySize} people on ${date}...`);
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
        print.info('Delete ~/.dine-at-disney-auth.json and run again to re-authenticate.');
        await playwrightManager.close();
        process.exit(-1);
      } else {
        print.warning(`API error on attempt ${numTries}. Retrying in 60s...`);
      }

      setTimeout(() => {
        checkTables({ date, onSuccess, numTries: numTries + 1, partySize, tables, print, ids, showBrowser });
      }, 60000);
      return;
    }

    const hasOffers = parseAvailability(data as AvailabilityApiResponse, date);
    const restaurantIds = Object.keys(hasOffers);

    if (restaurantIds.length === 0) {
      print.warning(`No offers found for anything. Checking again in 60s. ${numTries} total attempts.`);
      setTimeout(() => {
        checkTables({ date, onSuccess, numTries: numTries + 1, partySize, tables, print, ids, showBrowser });
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
              if (byMealPeriod.size <= 1) {
                print.success(
                  `Found offers at ${avail.cleanedTimes.map((t) => t.time).join(', ')} for ${
                    avail.restaurant.name
                  }. Checking again in 60s. ${numTries} total attempts.`
                );
              } else {
                print.success(`Found offers for ${avail.restaurant.name}. Checking again in 60s. ${numTries} total attempts.`);
                for (const [period, times] of byMealPeriod) {
                  print.success(`  ${period}: ${times.join(', ')}`);
                }
              }
              await onSuccess({ diningAvailability: avail });
            } else {
              print.warning(
                `No offers found for restaurant ID ${id}. Checking again in 60s. ${numTries} total attempts.`
              );
            }
          }
        } catch (err) {
          print.error(err);
        }

        setTimeout(() => {
          checkTables({ date, onSuccess, numTries: numTries + 1, partySize, tables, print, ids, showBrowser });
        }, 60000);
      } else {
        const { table } = print;
        print.success(`Found some offers on ${date}:`);

        table(
          [
            ['Name', 'ID', 'Available Times'],
            ...Object.entries(hasOffers)
              .sort(([, a], [, b]) => a.restaurant.name.localeCompare(b.restaurant.name))
              .map(([id, avail]) => [
                avail.restaurant.name,
                id,
                avail.cleanedTimes.map((t) => `${t.time} (${t.mealPeriod})`).join(', '),
              ]),
          ],
          {
            format: 'markdown',
          }
        );
        await playwrightManager.close();
        process.exit(0);
      }
    }
  }

  async function listPlaces({ print }: { print: GluegunPrint }): Promise<any> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const date = targetDate.toLocaleDateString('en-CA');

    print.info('Fetching restaurant list...');

    let data: any;
    try {
      data = await fetchJson(PLACES_URL(date));
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
