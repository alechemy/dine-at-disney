import * as path from 'path';
import * as os from 'os';

export type Resort = 'dlr' | 'wdw';

export interface ResortConfig {
  baseUrl: string;
  domain: string;
  authFile: string;
  placesPath: string;
}

export const RESORT_CONFIG: Record<Resort, ResortConfig> = {
  dlr: {
    baseUrl: 'https://disneyland.disney.go.com',
    domain: 'disneyland.disney.go.com',
    authFile: path.join(os.homedir(), '.dine-at-disney-auth-dlr.json'),
    placesPath: 'dlr/80008297',
  },
  wdw: {
    baseUrl: 'https://disneyworld.disney.go.com',
    domain: 'disneyworld.disney.go.com',
    authFile: path.join(os.homedir(), '.dine-at-disney-auth-wdw.json'),
    placesPath: 'wdw/80007798',
  },
};

export function getPlacesUrl(resort: Resort, date: string): string {
  const { baseUrl, placesPath } = RESORT_CONFIG[resort];
  return `${baseUrl}/finder/api/v1/explorer-service/list-ancestor-entities/${placesPath};entityType=destination/${date}/dining`;
}
