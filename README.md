![dine-at-disney](logo.png)

[![npm version](https://img.shields.io/npm/v/dine-at-disney)](https://www.npmjs.com/package/dine-at-disney)
[![npm downloads](https://img.shields.io/npm/dm/dine-at-disney)](https://www.npmjs.com/package/dine-at-disney)

A CLI tool for finding and monitoring dining reservations at Disney parks.

Supports **Disneyland Resort** (Disneyland + California Adventure) and **Walt Disney World** (Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom, and the Disney Springs/resort restaurants).

## Features

- List all restaurants that accept reservations, with their IDs
- Search for availability across every restaurant at once
- Filter results by party size, date, and time window
- Monitor specific restaurants and poll automatically every 60 seconds
- Send email or Pushover push notifications the moment a table opens up
- Supports both Disneyland Resort (`--resort dlr`) and Walt Disney World (`--resort wdw`)

## Installation

Requires **Node.js >= 20.12**.

```sh
npm install -g dine-at-disney
```

This also downloads the Chromium binary that [Playwright](https://playwright.dev/) needs. If that step was skipped (e.g. you ran with `--ignore-scripts`), install it manually:

```sh
npx playwright install chromium
```

## Example Usage

**You need a [MyDisney account](https://disneyaccount.disney.go.com/). On first run, a browser window will open for you to log in. Your session is saved locally and reused on subsequent runs.**

Sessions are stored per resort — `~/.dine-at-disney-auth-dlr.json` for Disneyland Resort, and `~/.dine-at-disney-auth-wdw.json` for Walt Disney World.

---

List all reservable restaurants and their IDs

```sh
dine-at-disney list
```

```
| Name                                    | ID       | Location              |
| --------------------------------------- | -------- | --------------------- |
| Blue Bayou Restaurant                   | 354099   | Disneyland Park       |
| Cafe Orleans                            | 354117   | Disneyland Park       |
| Carnation Cafe                          | 354129   | Disneyland Park       |
| Carthay Circle Restaurant               | 16515009 | Disney California Adv |
| Catal Restaurant                        | 354132   | Downtown Disney Dist  |
...
```

---

Search all restaurants for openings on a specific date

```sh
dine-at-disney search --date 2026-03-15 --party 2
```

```
Found some offers on 2026-03-15:
| Name                | ID       | Available Times                     |
| ------------------- | -------- | ----------------------------------- |
| Catal Restaurant    | 354132   | 5:00 PM (Dinner)                    |
| GCH Craftsman Bar   | 19343532 | 6:45 PM (Dinner), 8:00 PM (Dinner)  |
| Goofy's Kitchen     | 354261   | 7:35 PM (Dinner)                    |
| River Belle Terrace | 354450   | 5:30 PM (Dinner), 2:30 PM (Lunch)   |
```

> `--date` defaults to today. `--party` defaults to 2.

---

Narrow results to a specific time window

```sh
dine-at-disney search --date 2026-03-15 --party 2 --startTime "5:00 PM" --endTime "8:00 PM"
```

You can also provide just one bound — `--startTime "5:00 PM"` to search from that time onwards, or `--endTime "12:00 PM"` to search up until then.

---

Monitor a specific restaurant — polls every 60 seconds until a table appears

```sh
dine-at-disney search --date 2026-03-15 --party 2 --ids 19013078 --startTime "5:00 PM"
```

```
Checking for tables for 2 people on 2026-03-15 from 5:00 PM onwards for IDs: 19013078...
No offers found for restaurant ID 19013078.
Checking again in 60s. 1 total attempts.
🎉 Found offers at 5:30 PM, 7:00 PM for Lamplight Lounge!
   👉 Book now: https://disneyland.disney.go.com/dine-res/restaurant/19013078
Checking again in 60s. 2 total attempts.
```

---

Monitor multiple restaurants at once

```sh
dine-at-disney search --date 2026-03-15 --party 2 --ids "354261,354450"
```

---

Search by resort — Disneyland Resort or Walt Disney World

```sh
# Disneyland Resort (default)
dine-at-disney list --resort dlr
dine-at-disney search --resort dlr --date 2026-03-15 --party 2

# Walt Disney World
dine-at-disney list --resort wdw
dine-at-disney search --resort wdw --date 2026-03-15 --party 2
```

> `--resort` defaults to `dlr`.

---

Clear a saved session and re-authenticate

```sh
dine-at-disney search --resort dlr --reauth
```

> Use `--reauth` if your session has expired and you want to force a fresh login without manually deleting the auth file.

---

Watch the browser interact with Disney's site (useful for debugging)

```sh
dine-at-disney search --date 2026-03-15 --party 2 --show-browser
```

## Notifications

Notifications fire when monitoring with `--ids` and availability is found. Configure them by copying `.env.example` to `.env` and filling in the relevant fields.

### Email

Set the SMTP fields described in `.env.example`.

### Pushover

[Pushover](https://pushover.net/) is a one-time $5 purchase that delivers instant push notifications to your phone. Once set up, you'll get an alert with a direct booking link the moment a table opens.

![Push notification example](push.png)

Set `PUSHOVER_USER_KEY` and `PUSHOVER_API_TOKEN` in your `.env` file as described in `.env.example`.

## How it works

Disney's reservation site uses Akamai bot detection, which blocks direct API calls. This tool uses [Playwright](https://playwright.dev/) to drive a real Chromium browser (minimized in your dock), filling out Disney's search form and intercepting the underlying API responses. When monitoring a specific restaurant, it uses a hybrid approach — fast in-page API calls when possible, with automatic fallback to a full UI-driven search when Akamai intervenes.
