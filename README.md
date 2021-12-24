# dine-at-disney 🍽 🎆

A CLI tool for checking dining reservation availability at Disneyland / California Adventure.

## Installation

```bash
git clone git@github.com:alechemy/dine-at-disney.git
cd dine-at-disney
npm install
npm link
```

## Usage

### List Restaurants and their IDs

```bash
root@localhost:/usr/src/dine-at-disney# dine-at-disney list
Listing places...
| Name                   | ID       |
| ---------------------- | -------- |
| Award Wieners          | 354084   |
| Blue Bayou Restaurant  | 354099   |
| Cafe Orleans           | 354117   |
| Carnation Cafe         | 354129   |
| Catal Restaurant       | 354132   |
...
```

### Search for any openings

```bash
root@localhost:/usr/src/dine-at-disney# dine-at-disney search --date yyyy-mm-dd --party 2
Checking for tables for 2 people on 2021-12-14...
Found some offers on 2021-12-14:
| Name                                        | ID       | Available Times     |
| ------------------------------------------- | -------- | ------------------- |
| La Brea Bakery Cafe                         | 354327   | 13:45               |
| Naples Ristorante e Bar                     | 354378   | 15:30, 15:00, 14:00 |
| Storytellers Cafe                           | 354474   | 20:30               |
| Tortilla Jo's                               | 354528   | 19:00, 16:00, 15:30 |
| Uva Bar &amp; Cafe                          | 354540   | 14:30               |
| Magic Key Terrace - Magic Key Holder Dining | 15527906 | 17:55               |
| Carthay Circle Lounge - Alfresco Dining     | 16588263 | 12:50               |
| GCH Craftsman Bar                           | 19343532 | 14:45               |
```

### Search for specific openings

This will also use [notification](#notifications) settings below if configured

```bash
root@localhost:/usr/src/dine-at-disney# dine-at-disney search --date 2021-12-14 --party 2 --ids 19013078
Checking for tables for 2 people on 2021-12-14 for Lamplight Lounge...
No offers found for Lamplight Lounge. Checking again in 60s. 1 total attempts.
```

### Search for multiple specific openings

This will also use [notification](#notifications) settings below if configured

```bash
root@localhost:/usr/src/dine-at-disney# dine-at-disney search --date 2021-12-14 --party 2 --ids "354261,354450"
Checking for tables for 2 people on 2021-12-15 for Goofy's Kitchen, River Belle Terrace...
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
