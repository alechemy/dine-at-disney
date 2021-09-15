export interface DiningAvailability {
  [location: string]: { availableTimes: any[] };
}

export interface AvailabilityResponse {
  availability: DiningAvailability;
}

// Disney obfuscates their "meal periods" (breakfast/brunch/lunch/dinner) with these weird ids
export const mealPeriods = {
  breakast: 80000712, //
  brunch: 80000713,
  lunch: 80000717,
  dinner: 80000714,
};
