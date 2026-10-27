import { describe, expect, it } from 'vitest';

import {
  formatTrainNumberLabel,
  journeyReasonLabel,
  platformLabel,
  seatClassLabel,
  seatTypeLabel,
} from './journey-labels';

import { JourneyReasons, SeatClasses, SeatTypes } from '$lib/db/types';

describe('journey labels', () => {
  it('labels every seat class', () => {
    expect(SeatClasses.map(seatClassLabel)).toEqual([
      '2nd class',
      '1st class',
      'Business',
      'Premium',
      'Sleeper',
    ]);
  });

  it('labels every seat type', () => {
    expect(SeatTypes.map(seatTypeLabel)).toEqual([
      'Window',
      'Aisle',
      'Table',
      'Standing',
      'Other',
    ]);
  });

  it('labels every journey reason', () => {
    expect(JourneyReasons.map(journeyReasonLabel)).toEqual([
      'Leisure',
      'Business',
      'Commute',
      'Other',
    ]);
  });

  it('falls back to a title-cased value for unknown labels', () => {
    expect(seatClassLabel('economy')).toBe('Economy');
  });
});

describe('platformLabel', () => {
  it('prefixes the platform', () => {
    expect(platformLabel('7')).toBe('Platform 7');
    expect(platformLabel(' 12 Ovest ')).toBe('Platform 12 Ovest');
  });

  it('returns null for an empty platform', () => {
    expect(platformLabel(null)).toBeNull();
    expect(platformLabel(undefined)).toBeNull();
    expect(platformLabel('  ')).toBeNull();
  });
});

describe('formatTrainNumberLabel', () => {
  it('separates the category from the number', () => {
    expect(formatTrainNumberLabel('FR9600')).toBe('FR 9600');
    expect(formatTrainNumberLabel('ICE70')).toBe('ICE 70');
  });

  it('keeps other shapes untouched', () => {
    expect(formatTrainNumberLabel('9600')).toBe('9600');
    expect(formatTrainNumberLabel('FR 9600')).toBe('FR 9600');
  });

  it('returns null when there is no train number', () => {
    expect(formatTrainNumberLabel(null)).toBeNull();
    expect(formatTrainNumberLabel(' ')).toBeNull();
  });
});
