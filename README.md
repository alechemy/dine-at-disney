# dine-at-disney 🍽 🎆

A CLI tool for checking dining reservation availability at Disneyland / California Adventure.

## Features

- See a list of all restaurants that offer reservations.
- Search for availability across all restaurants, or narrow your query to specific places.
- Continually monitor a restaurant for availability, and receive email/push notifications when an opening is found.

## Installation

```sh
git clone https://github.com/alechemy/dine-at-disney.git
cd dine-at-disney
npm install
npm link
```

## Usage

### List restaurants and their IDs

```sh
dine-at-disney list
```

Sample output:

```prose
Listing places...
| Name                                                   | ID       |
| ------------------------------------------------------ | -------- |
| Blue Bayou Restaurant                                  | 354099   |
| Cafe Orleans                                           | 354117   |
| Carnation Cafe                                         | 354129   |
| Carthay Circle Lounge - Alfresco Dining                | 16588263 |
| Carthay Circle Restaurant                              | 16515009 |
| Catal Restaurant                                       | 354132   |
| Disney Princess Breakfast Adventures                   | 19140685 |
...
```

### Search for openings at any restaurant

```sh
dine-at-disney search --date yyyy-mm-dd --party 2
```

Sample output:

```prose
Checking for tables for 2 people on 2022-09-20...
Found some offers on 2022-09-20:
| Name                               | ID       | Available Times           |
| ---------------------------------- | -------- | ------------------------- |
| Catal Restaurant                   | 354132   | 5:00 PM                   |
| GCH Craftsman Bar                  | 19343532 | 6:45 PM, 8:00 PM          |
| Goofy's Kitchen                    | 354261   | 7:35 PM                   |
| La Brea Bakery Cafe                | 354327   | 2:30 PM                   |
| River Belle Terrace                | 354450   | 5:30 PM, 7:05 PM, 2:30 PM |
| Splitsville Luxury Lanes™ – Dining | 18735825 | 7:00 PM, 2:30 PM          |
| Storytellers Cafe                  | 354474   | 6:50 PM, 7:20 PM, 7:40 PM |
| Tortilla Jo's                      | 354528   | 6:30 PM, 7:00 PM, 2:00 PM |
```

### Search for openings at a specific restaurant

This will also use [notification](#notifications) settings below if configured

```sh
dine-at-disney search --date 2022-12-14 --party 2 --ids 19013078
```

Sample output:

```prose
Checking for tables for 2 people on 2022-12-14 for Lamplight Lounge...
No offers found for Lamplight Lounge. Checking again in 60s. 1 total attempts.
```

### Search for multiple specific openings

This will also use [notification](#notifications) settings below if configured

```sh
dine-at-disney search --date 2022-12-14 --party 2 --ids "354261,354450"
```

Sample output:

```prose
Checking for tables for 2 people on 2022-12-15 for Goofy's Kitchen, River Belle Terrace...
Found offers at 20:20 for Goofy's Kitchen. Checking again in 60s. 1 total attempts.
No offers found for River Belle Terrace. Checking again in 60s. 1 total attempts.
```

### Notifications

#### Mail alerts

See `.env.example` for info on the required fields for email alerting.

Copy those values into your own `.env` file.

#### Pushover alerts

For more information see: [https://pushover.net/](https://pushover.net/)

This service is a one time $5 fee forever. You can purchase a Pushover API token here: [https://pushover.net/pricing](https://pushover.net/pricing). Once setup you will get instant push notifications to your device when a table opens.

Additionally you can click the reserve link in the push notification to reserve the table.

![Push notification example](push.png)

See `.env.example` for info on the required fields for email alerting.

Copy those values into your own `.env` file.
