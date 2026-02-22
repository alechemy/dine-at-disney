import { DiningAvailability } from '../disney-api/model/response';
import { GluegunPrint } from 'gluegun';

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

  //Do not send more than 2 concurrent HTTP requests (TCP connections) to our API,
  //or we may do rate limiting on our side which may cause timeouts and refused connections for your IP.
  try {
    for (let cleanedTime of diningAvailability.cleanedTimes) {
      const response = await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user,
          token,
          title: `Found openings for ${diningAvailability.restaurant.name} on ${date} @ ${cleanedTime.time}`,
          message: `Found openings for ${partySize} people on ${date} for ${diningAvailability.restaurant.name} for the following time(s): ${cleanedTime.time}`,
          url: `https://disneyland.disney.go.com/dine-res/restaurant/${diningAvailability.restaurant.urlFriendlyId}/`,
          url_title: 'Reserve',
        }),
      });

      if (!response.ok) {
        throw new Error(`Pushover error: ${response.status}`);
      }

      const data: PushoverResponse = await response.json();

      if (data.status !== 1) {
        throw new Error(`Pushover error: ${data.errors.join(', ')}`);
      }
    }
  } catch (err) {
    print.error(err);
  }
}
