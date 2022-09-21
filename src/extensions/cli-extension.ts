import { GluegunToolbox, GluegunPrint } from 'gluegun';
import {
  AvailabilityResponse,
  DiningAvailabilities,
  mealPeriods,
  RestaurantMapping,
} from '../disney-api/model/response';
import merge from 'lodash/merge';

const HOST = 'disneyland.disney.go.com';
const BASE_URL = `https://${HOST}`;
const PLACES_URL = (date) =>
  `${BASE_URL}/finder/api/v1/explorer-service/list-ancestor-entities/dlr/80008297;entityType=destination/${date}/dining`;

/**
 * Sends a basic login POST request to obtain the auth cookies required for the restaurant details endpoint.
 *
 * @returns {Promise<Response>}
 */
const login = async () =>
  fetch(`${BASE_URL}/finder/api/v1/authz/public`, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'cache-control': 'no-cache',
      'content-type': 'application/json',
    },
    referrer: `${BASE_URL}/dining/`,
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: '{}',
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
  });

/**
 * Returns Restaurant Information (Real Names to IDs and such)
 * @param {string} date - date string in yyyy-mm-dd format
 * @returns {Array<any>}
 */
const getRestaurantMapping = async (print: GluegunPrint, date?: string): Promise<RestaurantMapping> => {
  if (!date) {
    // default to today's date in yyyy-mm-dd
    date = new Date().toLocaleDateString('en-CA');
  }

  const loginResponse = await login();
  const loginCookies = loginResponse.headers.get('set-cookie');

  const { results } = await fetch(`${PLACES_URL(date)}`, {
    headers: { cookie: loginCookies },
  }).then((res) => res.json());

  if (!results) {
    print.error('Failed to retrieve the list of available restaurants. Please try again.');
    process.exit(-1);
  }

  return results
    .filter((restaraunt) => restaraunt.facets.tableService?.includes('reservations-accepted'))
    .reduce(
      (prev: any, card: any) => ({
        ...prev,
        [card.id.split(';')[0]]: { ...card },
      }),
      {}
    ) as RestaurantMapping;
};

// add your CLI-specific functionality here, which will then be accessible
// to your commands
module.exports = (toolbox: GluegunToolbox) => {
  /**
   * Check Tables
   */
  async function checkTables({
    date,
    onSuccess,
    numTries = 1,
    partySize = 2,
    tables = [],
    print,
    ids,
    mapping,
  }: {
    date: string;
    onSuccess: Function;
    numTries?: number;
    partySize?: number;
    tables?: string[];
    print: GluegunPrint;
    ids?: string[];
    mapping?: RestaurantMapping;
  }): Promise<any> {
    mapping = mapping ?? (await getRestaurantMapping(print, date));

    // First time run message
    if (numTries === 1) {
      if (ids && ids.length > 0) {
        const displayNames = [];
        ids.forEach((id) => {
          if (!mapping[id]) {
            print.error(
              `Could not find restaurant with id ${id}. Run: 'dine-at-disney list' to see a list of restaurants.`
            );
            process.exit(-1);
          } else {
            displayNames.push(mapping[id].name);
          }
        });
        print.success(`Checking for tables for ${partySize} people on ${date} for ${displayNames.join(', ')}...`);
      } else {
        print.success(`Checking for tables for ${partySize} people on ${date}...`);
      }
    }

    const requests = Object.values(mealPeriods).map((mealPeriod) =>
      fetch(
        `${BASE_URL}/finder/api/v1/explorer-service/dining-availability-list/false/dlr/80008297;entityType=destination/${date}/${partySize.toString()}/?mealPeriod=${mealPeriod}`
      )
    );

    const allResults = await Promise.all(requests)
      .then((responses) =>
        Promise.all(
          // FIXME upstream: https://github.com/nodejs/undici/issues/1414
          responses.map(async (response) => {
            try {
              return await response.text();
            } catch (e) {
              print.error(e);
              return '{}';
            }
          })
        )
      )
      .then((responses) =>
        responses.map((res): AvailabilityResponse => {
          try {
            return JSON.parse(res);
          } catch (e) {
            print.error(e);
            return { availability: {} };
          }
        })
      )
      .then((res: AvailabilityResponse[]) => res.map((res) => res?.availability ?? {}));

    const mergedResults: AvailabilityResponse = merge(allResults);

    if (mergedResults) {
      const hasOffers: DiningAvailabilities = Object.entries(mergedResults as AvailabilityResponse)
        .filter(([_id, location]) => location.hasAvailability)
        .reduce(
          (acc, [key, val]) => (
            (acc[key.split(';')[0]] = {
              ...val,
              card: mapping[key.split(';')[0]],
              cleanedTimes: val.singleLocation.offers.map(({ date, label: time, url }) => ({
                date,
                time,
                // Direct Reservation Link
                directUrl: `${BASE_URL}/dining-reservation/setup-order/table-service/?offerId[]=${url}&offerOrigin=/dining/`,
              })),
            }),
            acc
          ),
          {}
        );

      const restaurantIds = Object.keys(hasOffers);

      if (restaurantIds.length === 0) {
        print.warning(`No offers found for anything. Checking again in 60s. ${numTries} total attempts.`);
        setTimeout(() => {
          checkTables({ date, onSuccess, numTries: (numTries += 1), tables, print, ids, mapping });
        }, 60000);
      } else {
        if (ids) {
          try {
            for (let id of ids) {
              if (restaurantIds.includes(id)) {
                print.success(
                  `Found offers at ${hasOffers[id].cleanedTimes.map((time) => time.time).join(', ')} for ${
                    mapping[id].name
                  }. Checking again in 60s. ${numTries} total attempts.`
                );
                await onSuccess({ diningAvailability: hasOffers[id] });
              } else {
                print.warning(
                  `No offers found for ${mapping[id].name}. Checking again in 60s. ${numTries} total attempts.`
                );
              }
            }
          } catch (err) {
            print.error(err);
          }

          //Keep checking for new offers
          setTimeout(() => {
            checkTables({ date, onSuccess, numTries: (numTries += 1), tables, print, ids, mapping });
          }, 60000);
        } else {
          const { table } = print;
          print.success(`Found some offers on ${date}:`);

          table(
            [
              ['Name', 'ID', 'Available Times'],
              ...Object.entries(hasOffers)
                .sort(([, aV]: any, [, bV]: any) => aV.card.name.localeCompare(bV.card.name))
                .map(([id, restaurant]) => [
                  restaurant.card.name,
                  id,
                  restaurant.cleanedTimes.map((time) => time.time).join(', '),
                ]),
            ],
            {
              format: 'markdown',
            }
          );
        }
      }
    } else {
      console.error('not ok');
    }
  }

  async function listPlaces({ print }: { print: GluegunPrint }): Promise<any> {
    const { table } = print;
    const mapping = await getRestaurantMapping(print);

    print.info(`Listing places...`);

    table(
      [
        ['Name', 'ID'],
        ...Object.entries(mapping)
          .sort(([, aV]: any, [, bV]: any) => aV.name.localeCompare(bV.name))
          .map(([k, v]: [k: any, v: any]) => [v.name, k]),
      ],
      {
        format: 'markdown',
      }
    );
  }

  toolbox.disneyApi = { checkTables, listPlaces };
};
