import { GluegunToolbox, http, GluegunPrint } from 'gluegun';
import { ApisauceInstance } from 'apisauce';
import { AvailabilityResponse, DiningAvailabilities, mealPeriods } from '../disney-api/model/response';
import mergeAll from 'lodash/fp/mergeAll';

const HOST = 'disneyland.disney.go.com';
const BASE_URL = `https://${HOST}`;
const PLACES_URL = (date) =>
  `${BASE_URL}/finder/api/v1/explorer-service/list-ancestor-entities/dlr/80008297;entityType=destination/${date}/dining`;

async function login() {
  return fetch(`${BASE_URL}/finder/api/v1/authz/public`, {
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
}

const disneyApi: ApisauceInstance = http.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    Accept: 'application/json',
    Host: 'disneyland.disney.go.com',
    'Cache-Control': 'no-cache',
    Referer: 'https://disneyland.disney.go.com/dining/',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
    Connection: 'keep-alive',
    'Accept-Encoding': 'gzip, deflate, br',
    'X-Cache-Control': 'no-cache',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Disney-Internal-Site': 'dlr',
  },
});

/**
 * Returns Restaurant Information (Real Names to IDs and such)
 * @param {ApisauceInstance} api
 * @returns {Array<any>}
 */
const restaurantMapping = async (date?: string) => {
  if (!date) {
    // default to today's date in yyyy-mm-dd format
    date = new Date().toLocaleDateString('en-CA');
  }

  const loginResponse = await login();
  const loginCookies = loginResponse.headers.get('set-cookie');

  const json = await fetch(`${PLACES_URL(date)}`, {
    headers: { cookie: loginCookies },
  }).then((res) => res.json());

  return json.results
    .filter((restaraunt) => restaraunt.facets.tableService?.includes('reservations-accepted'))
    .reduce(
      (prev: any, card: any) => ({
        ...prev,
        [card.id.split(';')[0]]: { ...card },
      }),
      {}
    );
};

/**
 * Retrieve a basic auth token that is required for requests to their dining availability endpoint
 * @param {ApisauceInstance} api
 * @returns {Promise<any>}
 */
async function getAuthToken(api: ApisauceInstance = disneyApi): Promise<any> {
  const { data } = await api.get('/authentication/get-client-token');
  return data;
}

// add your CLI-specific functionality here, which will then be accessible
// to your commands
module.exports = (toolbox: GluegunToolbox) => {
  /**
   * Check Tables
   */
  async function checkTables({
    date,
    onSuccess,
    api = disneyApi,
    numTries = 1,
    partySize = 2,
    tables = [],
    print,
    ids,
  }: {
    date: string;
    onSuccess: Function;
    api: ApisauceInstance;
    numTries?: number;
    partySize?: number;
    tables?: string[];
    print: GluegunPrint;
    ids?: string[];
  }): Promise<any> {
    const mapping = await restaurantMapping();

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

    const auth = await getAuthToken();
    api.setHeader('Authorization', `BEARER ${auth.access_token}`);

    const allResults = await Promise.all([
      api.get(
        `/api/wdpro/explorer-service/public/finder/dining-availability/80008297;entityType=destination?searchDate=${date}&partySize=${partySize.toString()}&mobile=false&mealPeriod=${
          mealPeriods.breakast
        }`
      ),
      api.get(
        `/api/wdpro/explorer-service/public/finder/dining-availability/80008297;entityType=destination?searchDate=${date}&partySize=${partySize.toString()}&mobile=false&mealPeriod=${
          mealPeriods.brunch
        }`
      ),
      api.get(
        `/api/wdpro/explorer-service/public/finder/dining-availability/80008297;entityType=destination?searchDate=${date}&partySize=${partySize.toString()}&mobile=false&mealPeriod=${
          mealPeriods.lunch
        }`
      ),
      api.get(
        `/api/wdpro/explorer-service/public/finder/dining-availability/80008297;entityType=destination?searchDate=${date}&partySize=${partySize.toString()}&mobile=false&mealPeriod=${
          mealPeriods.dinner
        }`
      ),
    ]).then((res) => res.map((res) => (res.data as AvailabilityResponse)?.availability));

    const mergedResults: AvailabilityResponse = mergeAll(allResults);

    if (mergedResults) {
      const hasOffers: DiningAvailabilities = Object.entries(mergedResults as AvailabilityResponse)
        .filter(([_id, location]) => location.availableTimes.some((time) => time.offers !== undefined))
        .reduce(
          (acc, [key, val]) => (
            (acc[key.split(';')[0]] = {
              ...val,
              card: mapping[key.split(';')[0]],
              cleanedTimes: val.availableTimes.reduce((carry, time) => {
                const offers = time.offers.map((offer) => ({
                  dateTime: offer.dateTime,
                  time: offer.time,
                  //Direct Reservation Link
                  directUrl: `https://disneyland.disney.go.com/dining-reservation/setup-order/table-service/?offerId[]=${offer.url}&offerOrigin=/dining/`,
                }));
                return [...carry, ...offers];
              }, {}),
            }),
            acc
          ),
          {}
        );

      const restaurantIds = Object.keys(hasOffers);

      if (restaurantIds.length === 0) {
        print.warning(`No offers found for anything. Checking again in 60s. ${numTries} total attempts.`);
        setTimeout(() => {
          checkTables({ date, onSuccess, api, numTries: (numTries += 1), tables, print, ids });
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
            checkTables({ date, onSuccess, api, numTries: (numTries += 1), tables, print, ids });
          }, 60000);
        } else {
          const { table } = print;
          print.success(`Found some offers on ${date}:`);

          table(
            [
              ['Name', 'ID', 'Available Times'],
              ...Object.entries(hasOffers).map(([id, restaurant]) => [
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

  async function listPlaces({ print }: { api: ApisauceInstance; print: GluegunPrint }): Promise<any> {
    const { table } = print;
    const mapping = await restaurantMapping();

    print.info(`Listing places...`);

    table([['Name', 'ID'], ...Object.entries(mapping).map(([k, v]: [k: any, v: any]) => [v.name, k])], {
      format: 'markdown',
    });
  }

  toolbox.disneyApi = { checkTables, listPlaces };
};
