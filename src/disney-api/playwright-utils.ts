import { chromium, Browser, BrowserContext, Page, Response } from 'playwright';
import * as fs from 'fs';
import { GluegunPrint } from 'gluegun';
import { Resort, ResortConfig, RESORT_CONFIG } from './resort-config';

export type { Resort };

export class PlaywrightManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private capturedHeaders: Record<string, string> | null = null;
  private showBrowser: boolean = false;
  private resort: Resort = 'dlr';

  private get config(): ResortConfig {
    return RESORT_CONFIG[this.resort];
  }

  async init(print: GluegunPrint, options?: { showBrowser?: boolean; resort?: Resort }) {
    if (this.page) return; // Already initialized
    this.showBrowser = options?.showBrowser ?? false;
    this.resort = options?.resort ?? 'dlr';

    const authFile = this.config.authFile;
    const hasAuth = fs.existsSync(authFile);

    try {
      if (hasAuth) {
        print.info('Loading saved Disney session...');
        await this.launchBrowser(print);

        const valid = await this.validateSession(print);
        if (!valid) {
          print.warning('Saved session has expired. Re-authenticating...');
          await this.close();
          fs.unlinkSync(authFile);
          await this.interactiveLogin(print);
          await this.launchBrowser(print);
        }
      } else {
        await this.interactiveLogin(print);
        await this.launchBrowser(print);
      }
    } catch (e: any) {
      if (e?.message?.includes("Executable doesn't exist")) {
        print.error('Playwright browser not found. Run the following command and try again:');
        print.info('  npx playwright install chromium');
        process.exit(1);
      }
      throw e;
    }
  }

  private async interactiveLogin(print: GluegunPrint) {
    print.warning('No valid Disney session found. Opening a browser for you to log in...');
    print.info('Please log in to your MyDisney account in the browser window.');
    print.info('The browser will close automatically once login is detected.');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${this.config.baseUrl}/login/`, { waitUntil: 'domcontentloaded' });

      print.info('Please complete the login in the browser window...');
      let loggedIn = false;
      while (!loggedIn) {
        await page.waitForTimeout(2000);
        try {
          const url = page.url().toLowerCase();
          loggedIn =
            url.includes(this.config.domain) &&
            !url.includes('/login') &&
            !url.includes('registerdisney') &&
            !url.includes('authz');
        } catch {
          // Page might be navigating, ignore errors
        }
      }

      print.info('Login detected! Saving session...');
      await page.waitForTimeout(5000);
      await context.storageState({ path: this.config.authFile });
      print.success('Session saved successfully!');
    } catch (e) {
      print.error('Login process was interrupted.');
      process.exit(-1);
    } finally {
      await browser.close();
    }
  }

  private async launchBrowser(print?: GluegunPrint) {
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext({
      storageState: this.config.authFile,
    });
    this.page = await this.context.newPage();

    // Minimize the browser window via CDP so it doesn't steal focus
    if (!this.showBrowser) {
      const cdp = await this.page.context().newCDPSession(this.page);
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'minimized' },
      });
    }

    // Capture headers from availability API requests for use in retriggerSearch()
    this.page.on('request', (req) => {
      if (req.url().includes('/dine-res/api/availability/')) {
        this.capturedHeaders = req.headers();
      }
    });

    // Navigate to the availability search page
    if (print) print.info('Loading availability search page...');
    await this.page.goto(`${this.config.baseUrl}/dine-res/availability/`, {
      waitUntil: 'commit',
      timeout: 30000,
    });

    // Wait for the Angular app to bootstrap and Akamai sensors to settle
    if (print) print.info('Waiting for page to initialize...');
    await this.page.waitForTimeout(10000);
    if (print) print.info('Page ready.');
  }

  private async validateSession(print: GluegunPrint): Promise<boolean> {
    if (!this.page) return false;

    try {
      const currentUrl = this.page.url();
      print.info(`  Browser at: ${currentUrl}`);

      if (currentUrl.includes('login') || currentUrl.includes('registerdisney')) {
        return false;
      }

      return currentUrl.includes(this.config.domain);
    } catch {
      return false;
    }
  }

  /**
   * Search availability by interacting with the dine-res Angular app UI.
   * Sets party size and date, clicks search, and intercepts the API response.
   */
  async searchAvailability(partySize: number, date: string, print?: GluegunPrint): Promise<any> {
    if (!this.page) {
      throw new Error('Playwright not initialized. Call init() first.');
    }

    try {
      // Wait for Akamai "Processing Request" overlay to clear
      const waitingRoom = this.page.locator('#sec-overlay');
      if (await waitingRoom.isVisible({ timeout: 10000 }).catch(() => false)) {
        if (print) print.info('  Waiting room detected. Waiting for it to clear...');
        await waitingRoom.waitFor({ state: 'hidden', timeout: 60000 });
      }

      await this.page.waitForSelector('.collapsible-panel.party-size .cta-heading', {
          state: 'visible',
          timeout: 15000
      });

      const availabilityPromise = this.page.waitForResponse(
        (res) => res.url().includes('/dine-res/api/availability/'),
        { timeout: 30000 }
      ).catch(() => null);

      // 1. Select Party Size
      if (print) print.info(`Setting party size to ${partySize}...`);
      const partyBtn = this.page.locator(`#count-selector${partySize}`);
      const partyHeading = this.page.locator('.collapsible-panel.party-size .cta-heading');
      if (await partyHeading.getAttribute('aria-expanded') !== 'true') {
        await partyHeading.click({ force: true });
        await this.page.waitForTimeout(1000);
      }
      await partyBtn.waitFor({ state: 'visible', timeout: 5000 });
      await partyBtn.click({ force: true });
      await this.page.waitForTimeout(1000);

      // 2. Select Date
      if (print) print.info(`Setting date to ${date}...`);
      const dateHeading = this.page.locator('.collapsible-panel.date .cta-heading');
      if (await dateHeading.getAttribute('aria-expanded') !== 'true') {
        await dateHeading.click({ force: true });
        await this.page.waitForTimeout(1000);
      }

      const dateLoc = this.page.locator(`[data-date="${date}"]`).first();
      let monthClicks = 0;
      while (!(await dateLoc.isVisible()) && monthClicks < 12) {
        const nextMonthBtn = this.page.locator('.collapsible-panel.date button[name="Next"][aria-label="Next Month"]').first();
        if (await nextMonthBtn.isVisible()) {
          if (await nextMonthBtn.isDisabled()) break;
          await nextMonthBtn.click({ force: true });
          await this.page.waitForTimeout(1500);
          monthClicks++;
        } else {
          break;
        }
      }

      // Use waitFor instead of isVisible() so we tolerate residual calendar animation
      const dateVisible = await dateLoc.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
      if (!dateVisible) {
        throw new Error(`Date ${date} is not available to select. It might be too far in the future or past.`);
      }

      await dateLoc.click({ force: true });
      await this.page.waitForTimeout(1000);

      const dateNextBtn = this.page.locator('#btnCancel');
      if (await dateNextBtn.isVisible()) {
        await dateNextBtn.click({ force: true });
        await this.page.waitForTimeout(1000);
      }

      // 3. Select Time
      const timeHeading = this.page.locator('.collapsible-panel.time .cta-heading');
      if (await timeHeading.getAttribute('aria-expanded') !== 'true') {
        await timeHeading.click({ force: true });
        await this.page.waitForTimeout(1000);
      }

      const timeBtn = this.page.locator('button[id="unique_id_time_All Day"]');
      if (await timeBtn.isVisible()) {
        await timeBtn.click({ force: true });
        await this.page.waitForTimeout(1000);
      }

      // 4. Click Next on Time panel
      const timeNextBtn = this.page.locator('wdpr-button#timeSearchButton');
      await timeNextBtn.waitFor({ state: 'visible', timeout: 5000 });
      await timeNextBtn.click({ force: true });

      // 5. Click Done on Location panel — wait for it to appear after the time step advances
      if (print) print.info('Clicking search...');
      const locationBtn = this.page.locator('button#btnLocationDone').first();
      await locationBtn.waitFor({ state: 'visible', timeout: 5000 });
      await locationBtn.click({ force: true });
      await this.page.waitForTimeout(1000);

      if (print) print.info('Waiting for availability results...');
      const response: Response | null = await availabilityPromise;

      if (!response) {
         if (print) print.warning(`Availability API timed out.`);
         return null;
      }

      if (response.status() !== 200) {
        if (print) print.warning(`Availability API returned ${response.status()}`);
        return null;
      }

      return await response.json();
    } catch (e: any) {
      if (print) print.info(`  Error during search: ${e?.message?.substring(0, 150)}`);
      return null;
    }
  }

  /**
   * Make a single in-page fetch to the availability API using captured headers.
   * Returns the parsed JSON, or an object with { error, status } on failure.
   */
  private async fetchAvailability(apiUrl: string, headers: Record<string, string>): Promise<any> {
    return this.page!.evaluate(async ({ url, hdrs }: { url: string; hdrs: Record<string, string> }) => {
      try {
        const res = await fetch(url, {
          credentials: 'include',
          headers: hdrs,
        });
        if (!res.ok) {
          return { error: true, status: res.status };
        }
        return await res.json();
      } catch (e: any) {
        return { error: true, message: e?.message };
      }
    }, { url: apiUrl, hdrs: headers });
  }

  /**
   * Re-trigger a search by calling the availability API directly via fetch()
   * inside the page's JavaScript context, replaying the same headers that the
   * Angular app used during the initial search.
   *
   * If the fetch returns 428 (Akamai bot challenge), we navigate back to the
   * availability form and do a full UI-driven search to reset Akamai's state.
   * This captures fresh headers for subsequent in-page fetches.
   */
  async retriggerSearch(partySize: number, date: string, print?: GluegunPrint): Promise<any> {
    if (!this.page) return null;

    if (!this.capturedHeaders) {
      if (print) print.warning('No captured headers from initial search. Falling back to full search.');
      return this.searchAvailability(partySize, date, print);
    }

    try {
      if (print) print.info('Fetching availability via in-page API call...');

      const apiUrl = `/dine-res/api/availability/${partySize}/${date},${date}/00:00:00,23:59:59?trim=facets,media,webLinks,mediaGalleries,sortProductName&trimExclude=dining-events,diningEvent`;

      const headers: Record<string, string> = {};
      const headerKeys = [
        'authorization',
        'x-correlation-id',
        'x-conversation-id',
        'x-function-name',
        'x-disney-internal-dine-vas-365',
        'x-disney-internal-dine-vas-eks',
        'accept',
      ];
      for (const key of headerKeys) {
        if (this.capturedHeaders[key]) {
          headers[key] = this.capturedHeaders[key];
        }
      }

      const result = await this.fetchAvailability(apiUrl, headers);

      // If we hit a 428, Akamai is blocking us. Navigate back to the form and
      // do a full UI-driven search to reset sensor state and get fresh headers.
      if (result?.error && result?.status === 428) {
        if (print) print.info('  Got 428 — resetting via full UI search...');

        // Wait for any Akamai challenge overlay to finish first
        const waitingRoom = this.page.locator('#sec-overlay');
        const overlayVisible = await waitingRoom.isVisible({ timeout: 5000 }).catch(() => false);
        if (overlayVisible) {
          await waitingRoom.waitFor({ state: 'hidden', timeout: 60000 });
        }

        // Navigate back to the availability form
        await this.page.goto(`${this.config.baseUrl}/dine-res/availability/`, {
          waitUntil: 'commit',
          timeout: 30000,
        });
        await this.page.waitForTimeout(10000);

        // Do a full UI-driven search (this also refreshes capturedHeaders)
        return this.searchAvailability(partySize, date, print);
      }

      if (result?.error) {
        if (print) print.warning(`Availability API returned ${result.status || result.message}`);
        return null;
      }

      return result;
    } catch (e: any) {
      if (print) print.info(`  Re-trigger error: ${e?.message?.substring(0, 120)}`);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}
