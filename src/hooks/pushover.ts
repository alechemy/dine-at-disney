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
  baseUrl,
}: {
  diningAvailability: DiningAvailability;
  print: GluegunPrint;
  partySize: number;
  date: string;
  baseUrl: string;
}) {
  if (!user || !token) {
    print.warning('No pushover credentials provided');
    return;
  }

  try {
    const times = diningAvailability.cleanedTimes.map((t) => t.time).join(', ');
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user,
        token,
        title: `Found openings for ${diningAvailability.restaurant.name} on ${date}`,
        message: `Found openings for ${partySize} people on ${date} for ${diningAvailability.restaurant.name}: ${times}`,
        url: `${baseUrl}/dine-res/restaurant/${diningAvailability.restaurant.id}/`,
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
  } catch (err) {
    print.error(err);
  }
}
