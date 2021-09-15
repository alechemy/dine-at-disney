import { GluegunToolbox, http } from 'gluegun';
import { ApisauceInstance } from 'apisauce';
import { AvailabilityResponse, DiningAvailability, mealPeriods } from '../disney-api/model/response';
import mergeAll from 'lodash/fp/mergeAll';

const disneyApi: ApisauceInstance = http.create({
  baseURL: 'https://disneyland.disney.go.com',
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

// Retrieve a basic auth token that is required for requests to their dining availability endpoint
async function getAuthToken(api: ApisauceInstance = disneyApi): Promise<any> {
  const { data } = await api.get('/authentication/get-client-token');
  return data;
}

// add your CLI-specific functionality here, which will then be accessible
// to your commands
module.exports = (toolbox: GluegunToolbox) => {
  async function checkTables(
    date,
    onSuccess,
    api: ApisauceInstance = disneyApi,
    numTries = 1,
    tables = []
  ): Promise<any> {
    const auth = await getAuthToken();
    api.setHeader('Authorization', `BEARER ${auth.access_token}`);

    const allResults = await Promise.all([
      api.get(
        `/api/wdpro/explorer-service/public/finder/dining-availability/80008297;entityType=destination?searchDate=${date}&partySize=2&mobile=false&mealPeriod=${mealPeriods.breakast}`
      ),
      api.get(
        `/api/wdpro/explorer-service/public/finder/dining-availability/80008297;entityType=destination?searchDate=${date}&partySize=2&mobile=false&mealPeriod=${mealPeriods.brunch}`
      ),
      api.get(
        `/api/wdpro/explorer-service/public/finder/dining-availability/80008297;entityType=destination?searchDate=${date}&partySize=2&mobile=false&mealPeriod=${mealPeriods.lunch}`
      ),
      api.get(
        `/api/wdpro/explorer-service/public/finder/dining-availability/80008297;entityType=destination?searchDate=${date}&partySize=2&mobile=false&mealPeriod=${mealPeriods.dinner}`
      ),
    ]).then((res) => res.map((res) => (res.data as AvailabilityResponse)?.availability));

    const mergedResults: AvailabilityResponse = mergeAll(allResults);

    if (mergedResults) {
      const hasOffers: DiningAvailability = Object.entries(mergedResults as AvailabilityResponse)
        .filter(([_id, location]) => location.availableTimes.some((time) => time.offers !== undefined))
        .reduce((acc, [id, val]) => ((acc[id.split(';')[0]] = val), acc), {}); // use comma operator to return mutated acc

      const restaurantIds = Object.keys(hasOffers);

      if (restaurantIds.length === 0) {
        console.log(`Didn't find anything. Checking again in 60s. ${numTries} total attempts.`);
        setTimeout(() => {
          checkTables(date, onSuccess, api, (numTries += 1), tables);
        }, 60000);
        // FIXME: Temporary, hard-coded search for Lamplight Lounge availability.
      } else if (!restaurantIds.includes('19629820')) {
        console.log(restaurantIds);
        console.log(`Didn't find the restaurant we want. Checking again in 60s. ${numTries} total attempts.`);
        setTimeout(() => {
          checkTables(date, onSuccess, api, (numTries += 1), tables);
        }, 60000);
      } else {
        // Seems like we found something
        onSuccess(hasOffers);
      }
    } else {
      console.log('not ok');
    }
  }

  toolbox.disneyApi = { checkTables };
};
