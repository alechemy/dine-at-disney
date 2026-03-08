import { exec } from 'child_process';
import { promisify } from 'util';
import { DiningAvailability } from '../disney-api/model/response';
import { GluegunPrint } from 'gluegun';

const execAsync = promisify(exec);

export default async function macos({
  diningAvailability,
  print,
  partySize,
  date,
}: {
  diningAvailability: DiningAvailability;
  print: GluegunPrint;
  partySize: number;
  date: string;
}) {
  if (process.platform !== 'darwin') {
    print.warning('macOS notifications are only supported on macOS.');
    return;
  }

  const escapeAppleScriptString = (str: string) => str.replace(/"/g, '\\"');
  const escapeShellArg = (str: string) => `'${str.replace(/'/g, "'\\''")}'`;

  try {
    const times = diningAvailability.cleanedTimes.map((t) => t.time).join(', ');
    const title = 'Dine at Disney';
    const subtitle = escapeAppleScriptString(diningAvailability.restaurant.name);
    const message = escapeAppleScriptString(
      `Found openings for ${partySize} people on ${date}: ${times}`
    );

    const script = `display notification "${message}" with title "${title}" subtitle "${subtitle}" sound name "Glass"`;

    await execAsync(`osascript -e ${escapeShellArg(script)}`);
  } catch (error) {
    print.warning(`Failed to send macOS notification: ${error instanceof Error ? error.message : String(error)}`);
  }
}
