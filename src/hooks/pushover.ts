import { DiningAvailability } from '../disney-api/model/response';
import { http, GluegunPrint } from 'gluegun';

interface PushoverResponse {
  status: number;
  request: string;
  errors?: any[];
}

const user = process.env.PUSHOVER_USER;
const token = process.env.PUSHOVER_TOKEN;

export default async function pushover({
  diningAvailability,
  print,
  partySize,
  date,
}: {
  diningAvailability: DiningAvailability;
  print: GluegunPrint;
  partySize: number;
  date: string;
}) {
  if (!user || !token) {
    print.warning('No pushover credentials provided');
    return;
  }

  const api = http.create({
    baseURL: 'https://api.pushover.net',
  });

  //Do not send more than 2 concurrent HTTP requests (TCP connections) to our API,
  //or we may do rate limiting on our side which may cause timeouts and refused connections for your IP.
  try {
    for (let cleanedTime of diningAvailability.cleanedTimes) {
      const response = await api.post('/1/messages.json', {
        user,
        token,
        title: `Found openings for ${diningAvailability.card.displayName} on ${date} @ ${cleanedTime.time}`,
        message: `Found openings for ${partySize} people on ${date} for ${diningAvailability.card.displayName} for the following time(s): ${cleanedTime.time}`,
        url: cleanedTime.directUrl,
        url_title: 'Reserve',
      });

      if (response.status === 200) {
        const data = <PushoverResponse>response.data;

        if (data.status !== 1) {
          throw new Error(`Pushover error: ${data.errors.join(', ')}`);
        }
      } else {
        throw new Error(`Pushover error: ${response.status}`);
      }
    }
  } catch (err) {
    print.error(err);
  }
}
