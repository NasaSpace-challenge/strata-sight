import { describe, expect, it } from 'vitest';
import { addDays, clampDate, localSolarTime, formatDay, layerKeyForVariable, mediaQueriesFor, snapshotUrl, timeAgo, worldviewUrl } from './earthView';

describe('earthView helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('clamps a date into a layer range', () => {
    const l = { start: '2000-02-24', end: '2026-11-15' };
    expect(clampDate('1999-01-01', l)).toBe('2000-02-24');
    expect(clampDate('2030-01-01', l)).toBe('2026-11-15');
    expect(clampDate('2010-06-01', l)).toBe('2010-06-01');
  });

  it('formats days in UTC without timezone drift', () => {
    expect(formatDay('2026-11-14')).toBe('14 Nov 2026');
    expect(formatDay('2026-01-01T00:00:00Z')).toBe('1 Jan 2026');
  });

  it('describes how long ago something happened', () => {
    const now = new Date('2026-11-15T12:00:00Z').getTime();
    expect(timeAgo('2026-11-15T01:00:00Z', now)).toBe('today');
    expect(timeAgo('2026-11-14T01:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2026-11-10T01:00:00Z', now)).toBe('5 days ago');
  });

  it('builds media search terms from the most specific place first, without duplicates', () => {
    expect(mediaQueriesFor({ name: 'Lahore', admin1: 'Punjab', country: 'Pakistan' })).toEqual(['Lahore', 'Pakistan']);
    expect(mediaQueriesFor({ name: 'Singapore', country: 'Singapore' })).toEqual(['Singapore']);
    expect(mediaQueriesFor({ name: 'Aral Sea Ecological Basin (Central Asia)' })).toEqual(['Aral Sea Ecological Basin']);
    expect(mediaQueriesFor({ name: 'X', admin1: 'Sindh' })).toEqual(['Sindh']);
  });

  it('maps science variables to a matching satellite layer', () => {
    expect(layerKeyForVariable('aod550')).toBe('aerosol');
    expect(layerKeyForVariable('co2_mlo')).toBeNull();
  });

  it('builds snapshot and Worldview links', () => {
    expect(snapshotUrl('terra', 31.4234, 74.3399, '2026-11-14')).toBe(
      '/api/imagery/snapshot?layer=terra&lat=31.42&lon=74.34&date=2026-11-14&span=100&size=640'
    );
    const wv = worldviewUrl('MODIS_Terra_CorrectedReflectance_TrueColor', 31.4, 74.3, '2026-11-14');
    expect(wv).toContain('worldview.earthdata.nasa.gov');
    expect(wv).toContain('t=2026-11-14');
    expect(wv).not.toContain('BlueMarble');
    expect(worldviewUrl('MODIS_Terra_Aerosol', 0, 0, '2026-11-14')).toContain('BlueMarble');
  });
});

describe('localSolarTime', () => {
  it('shifts UTC by 4 minutes per degree of longitude', () => {
    expect(localSolarTime('2026-11-12 12:00:00', 0)).toBe('12:00');
    expect(localSolarTime('2026-11-12 12:00:00', 90)).toBe('18:00');
    expect(localSolarTime('2026-11-12 02:30:00', -75)).toBe('21:30');
    expect(localSolarTime('2026-11-12 23:50:00', 15)).toBe('00:50');
  });
});
