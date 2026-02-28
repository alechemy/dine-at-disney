import * as os from 'os';
import * as path from 'path';
import { RESORT_CONFIG, getPlacesUrl } from '../src/disney-api/resort-config';

describe('RESORT_CONFIG', () => {
  it('dlr has correct base URL and domain', () => {
    expect(RESORT_CONFIG.dlr.baseUrl).toBe('https://disneyland.disney.go.com');
    expect(RESORT_CONFIG.dlr.domain).toBe('disneyland.disney.go.com');
  });

  it('wdw has correct base URL and domain', () => {
    expect(RESORT_CONFIG.wdw.baseUrl).toBe('https://disneyworld.disney.go.com');
    expect(RESORT_CONFIG.wdw.domain).toBe('disneyworld.disney.go.com');
  });

  it('dlr uses the dlr-suffixed auth file path', () => {
    expect(RESORT_CONFIG.dlr.authFile).toBe(path.join(os.homedir(), '.dine-at-disney-auth-dlr.json'));
  });

  it('wdw uses a separate auth file', () => {
    expect(RESORT_CONFIG.wdw.authFile).toBe(path.join(os.homedir(), '.dine-at-disney-auth-wdw.json'));
    expect(RESORT_CONFIG.wdw.authFile).not.toBe(RESORT_CONFIG.dlr.authFile);
  });
});

describe('getPlacesUrl', () => {
  const date = '2026-03-15';

  it('generates a DLR places URL with the correct base URL and resort path', () => {
    const url = getPlacesUrl('dlr', date);
    expect(url).toContain('disneyland.disney.go.com');
    expect(url).toContain('dlr/80008297');
    expect(url).toContain(date);
  });

  it('generates a WDW places URL with the correct base URL and resort path', () => {
    const url = getPlacesUrl('wdw', date);
    expect(url).toContain('disneyworld.disney.go.com');
    expect(url).toContain('wdw/80007798');
    expect(url).toContain(date);
  });

  it('DLR and WDW URLs are distinct', () => {
    expect(getPlacesUrl('dlr', date)).not.toBe(getPlacesUrl('wdw', date));
  });
});
