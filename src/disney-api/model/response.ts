export interface CleanedTime {
  date: string;
  time: string;
  label: string;
  mealPeriod: string;
  offerId: string;
}

export interface Offer {
  offerId: string;
  time: string;
  label: string;
}

export interface MealPeriodOffer {
  enterpriseMealPeriodId: string;
  mealPeriodType: string;
  mealPeriodName: string;
  startTime: string;
  endTime: string;
  cuisine: string;
  serviceStyle: string;
  experienceType: string;
  offersByAccessibility: {
    accessibilityLevel: string;
    offers: Offer[];
  }[];
}

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  mealPeriodType: string;
  priceRange: string;
  experienceType: string;
  primaryCuisineType: string;
  urlFriendlyId: string;
  ancestorLocationParkResort: string;
  ancestorLocationLandArea: string;
  offers: { [date: string]: MealPeriodOffer[] };
}

export interface DiningAvailability {
  restaurant: Restaurant;
  cleanedTimes: CleanedTime[];
}

export interface DiningAvailabilities {
  [restaurantId: string]: DiningAvailability;
}

export interface EventTime {
  eventProductId: string;
  eventLabel: string;
  eventFacilityId: string;
  restaurant: { [id: string]: Restaurant };
}

export interface DiningEvent {
  name: string;
  id: string;
  eventTimes: EventTime[];
}

export interface AvailabilityApiResponse {
  restaurant: { [id: string]: Restaurant };
  diningEvent?: { [id: string]: DiningEvent };
  statusCode: number;
}
