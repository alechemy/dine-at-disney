export interface CleanedTime {
  date: string;
  time: string;
  directUrl: string;
}

export interface Card {
  id: string;
  ref: string;
  supportMaxPartySize: boolean;
  urlFriendlyId: string;
  isEEC: boolean;
  name: string;
}

export interface DiningAvailability {
  availableTimes: any[];
  card: Card;
  cleanedTimes: CleanedTime[];
}

export interface DiningAvailabilities {
  [location: string]: DiningAvailability;
}

export interface AvailabilityResponse {
  availability: DiningAvailabilities;
}

// Disney obfuscates their "meal periods" (breakfast/brunch/lunch/dinner) with these weird ids
export const mealPeriods = {
  breakfast: 80000712, //
  brunch: 80000713,
  lunch: 80000717,
  dinner: 80000714,
};
