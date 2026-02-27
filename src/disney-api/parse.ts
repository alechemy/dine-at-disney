import {
  AvailabilityApiResponse,
  CleanedTime,
  DiningAvailabilities,
  MealPeriodOffer,
  Restaurant,
} from './model/response';

export function summarizeTimes(cleanedTimes: CleanedTime[], maxLength = 80): string {
  const byMealPeriod = new Map<string, string[]>();
  for (const t of cleanedTimes) {
    const times = byMealPeriod.get(t.mealPeriod) || [];
    times.push(t.time);
    byMealPeriod.set(t.mealPeriod, times);
  }
  const parts = Array.from(byMealPeriod.entries()).map(([period, times]) => {
    if (times.length === 1) return `${period}: ${times[0]}`;
    return `${period}: ${times[0]}–${times[times.length - 1]} (${times.length} slots)`;
  });

  let result = '';
  for (let i = 0; i < parts.length; i++) {
    const next = result ? `${result} | ${parts[i]}` : parts[i];
    if (result && next.length > maxLength) {
      const remaining = parts.length - i;
      return `${result} | +${remaining} more...`;
    }
    result = next;
  }
  return result;
}

export function extractCleanedTimes(
  dateOffers: MealPeriodOffer[],
  date: string,
  useMealPeriodName = false
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

export function parseTime(timeStr: string): number {
  if (!timeStr) return -1;
  const match = timeStr.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/**
 * Parse the dine-res availability API response into our internal format.
 * Handles both regular restaurants and dining events (e.g. World of Color Dining Package).
 */
export function parseAvailability(
  data: AvailabilityApiResponse,
  date: string,
  startTime?: string,
  endTime?: string
): DiningAvailabilities {
  const result: DiningAvailabilities = {};

  const startMins = startTime ? parseTime(startTime) : 0;
  const endMins = endTime ? parseTime(endTime) : 24 * 60;

  function filterTimes(times: CleanedTime[]) {
    return times.filter((t) => {
      const m = parseTime(t.time);
      return m >= startMins && m <= endMins;
    });
  }

  // Regular restaurants
  if (data?.restaurant) {
    for (const [id, restaurant] of Object.entries(data.restaurant)) {
      const dateOffers = restaurant.offers?.[date];
      if (!dateOffers || dateOffers.length === 0) continue;

      let cleanedTimes = extractCleanedTimes(dateOffers, date);
      cleanedTimes = filterTimes(cleanedTimes);
      if (cleanedTimes.length === 0) continue;

      result[id] = { restaurant, cleanedTimes };
    }
  }

  // Dining events (e.g. World of Color Dining Package) — these nest restaurants
  // inside eventTimes[]. We key the result by dining event ID so --ids matching works,
  // and flatten all offers from all sub-restaurants into one entry.
  if (data?.diningEvent) {
    for (const [eventId, event] of Object.entries(data.diningEvent)) {
      let allCleanedTimes: CleanedTime[] = [];
      let firstRestaurant: Restaurant | null = null;

      for (const eventTime of event.eventTimes || []) {
        for (const restaurant of Object.values(eventTime.restaurant || {})) {
          if (!firstRestaurant) firstRestaurant = restaurant;
          const dateOffers = restaurant.offers?.[date];
          if (!dateOffers || dateOffers.length === 0) continue;
          allCleanedTimes.push(...extractCleanedTimes(dateOffers, date, true));
        }
      }

      allCleanedTimes = filterTimes(allCleanedTimes);

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
