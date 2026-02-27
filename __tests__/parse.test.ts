import { parseTime, parseAvailability } from '../src/disney-api/parse';

describe('parseTime', () => {
  it('should parse 24-hour time correctly', () => {
    expect(parseTime('13:00')).toBe(13 * 60); // 780
    expect(parseTime('08:00')).toBe(8 * 60);  // 480
    expect(parseTime('00:00')).toBe(0);
  });

  it('should parse 12-hour AM time correctly', () => {
    expect(parseTime('8:00 AM')).toBe(8 * 60);   // 480
    expect(parseTime('08:00 AM')).toBe(8 * 60);  // 480
    expect(parseTime('11:59 AM')).toBe(11 * 60 + 59); // 719
  });

  it('should parse 12-hour PM time correctly', () => {
    expect(parseTime('1:00 PM')).toBe(13 * 60);  // 780
    expect(parseTime('01:00 PM')).toBe(13 * 60); // 780
    expect(parseTime('11:59 PM')).toBe(23 * 60 + 59); // 1439
  });

  it('should handle 12:00 AM and 12:00 PM edge cases', () => {
    expect(parseTime('12:00 AM')).toBe(0);
    expect(parseTime('12:00 PM')).toBe(12 * 60); // 720
    expect(parseTime('12:30 PM')).toBe(12 * 60 + 30); // 750
  });

  it('should return -1 for invalid times', () => {
    expect(parseTime('')).toBe(-1);
    expect(parseTime('invalid')).toBe(-1);
  });
});

describe('parseAvailability filtering', () => {
  const date = '2026-03-15';

  const mockData: any = {
    restaurant: {
      '123': {
        id: '123',
        name: 'Test Restaurant',
        url: 'test',
        description: 'test',
        fastPassPlus: false,
        hostage: false,
        type: 'restaurant',
        offers: {
          [date]: [
            {
              mealPeriodType: 'Breakfast',
              mealPeriodName: 'Breakfast',
              offersByAccessibility: [
                {
                  accessibilityLevel: 'standard',
                  offers: [
                    { label: '08:00 AM', offerId: '1', time: '08:00 AM' },
                    { label: '10:30 AM', offerId: '2', time: '10:30 AM' },
                  ],
                },
              ],
            },
            {
              mealPeriodType: 'Lunch',
              mealPeriodName: 'Lunch',
              offersByAccessibility: [
                {
                  accessibilityLevel: 'standard',
                  offers: [
                    { label: '12:00 PM', offerId: '3', time: '12:00 PM' },
                    { label: '1:00 PM', offerId: '4', time: '1:00 PM' },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  };

  it('should return all times if no startTime or endTime are provided', () => {
    const result = parseAvailability(mockData, date);
    expect(result['123']).toBeDefined();
    expect(result['123'].cleanedTimes.length).toBe(4);
    expect(result['123'].cleanedTimes.map((t) => t.time)).toEqual([
      '08:00 AM',
      '10:30 AM',
      '12:00 PM',
      '1:00 PM',
    ]);
  });

  it('should filter times before startTime', () => {
    const result = parseAvailability(mockData, date, '10:00 AM');
    expect(result['123']).toBeDefined();
    expect(result['123'].cleanedTimes.length).toBe(3);
    expect(result['123'].cleanedTimes.map((t) => t.time)).toEqual([
      '10:30 AM',
      '12:00 PM',
      '1:00 PM',
    ]);
  });

  it('should filter times after endTime', () => {
    const result = parseAvailability(mockData, date, undefined, '12:30 PM');
    expect(result['123']).toBeDefined();
    expect(result['123'].cleanedTimes.length).toBe(3);
    expect(result['123'].cleanedTimes.map((t) => t.time)).toEqual([
      '08:00 AM',
      '10:30 AM',
      '12:00 PM',
    ]);
  });

  it('should filter times strictly within startTime and endTime bounds', () => {
    const result = parseAvailability(mockData, date, '09:00', '12:30'); // Mixing 24-hour inputs
    expect(result['123']).toBeDefined();
    expect(result['123'].cleanedTimes.length).toBe(2);
    expect(result['123'].cleanedTimes.map((t) => t.time)).toEqual([
      '10:30 AM',
      '12:00 PM',
    ]);
  });

  it('should omit the restaurant entirely if all times are filtered out', () => {
    const result = parseAvailability(mockData, date, '04:00 PM', '09:00 PM');
    expect(result['123']).toBeUndefined();
    expect(Object.keys(result).length).toBe(0);
  });
});
