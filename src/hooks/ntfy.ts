import { DiningAvailability } from '../disney-api/model/response';
import { GluegunPrint } from 'gluegun';

const topic = process.env.NTFY_TOPIC;
const server = process.env.NTFY_SERVER || 'https://ntfy.sh';

export default async function ntfy({
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
  if (!topic) {
    print.warning('No NTFY_TOPIC provided');
    return;
  }

  try {
    const times = diningAvailability.cleanedTimes.map((t) => t.time).join(', ');
    const response = await fetch(`${server}/${topic}`, {
      method: 'POST',
      headers: {
        Title: `${diningAvailability.restaurant.name} - ${date}`,
        Click: `${baseUrl}/dine-res/restaurant/${diningAvailability.restaurant.id}/`,
        Tags: 'fork_and_knife',
      },
      body: `Found openings for ${partySize} people on ${date} for ${diningAvailability.restaurant.name}: ${times}\n\nBook now: ${baseUrl}/dine-res/restaurant/${diningAvailability.restaurant.id}/`,
    });

    if (!response.ok) {
      throw new Error(`ntfy error: ${response.status}`);
    }
  } catch (err) {
    print.error(err);
  }
}
