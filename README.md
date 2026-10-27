<div align="center">
  <img src="static/favicon.png" alt="TrainTrail logo" width="80" height="80">

<h3 align="center">TrainTrail</h3>

  <p align="center">
    A self-hosted web application to log the train journeys you take, see them on a map and explore your travel statistics.
  </p>
</div>

> **Status: early development.** TrainTrail started from an existing open-source flight tracker and is being converted
> to rail travel. Parts of the interface, the database schema and the bundled data still refer to flights and will be
> replaced with stations, operators, trains and journeys.

## ✨ Planned features

- **Map**: see every journey you took on an interactive map.
- **Journey history**: keep all your train trips in one place, with train number, platform, coach, seat and class.
- **Stations**: Europe-wide station list (about 23,000 railway stations, 3,900 of them in Italy), downloaded at first start.
- **Import a ticket**: read a journey from the message or e-mail of your operator, an Apple Wallet pass (`.pkpass`) or a Google Wallet link, instead of typing it.
- **Statistics**: distance, time on board, most used operators and stations, countries visited.
- **Multiple users**: share journeys, secure your data with authentication and integrate with your OAuth provider.
- **Responsive design** and **dark mode**.
- **Import and export** of your data.

## 🛠️ Development

Requirements: [Bun](https://bun.sh), [Docker](https://www.docker.com) (for PostgreSQL) and Node.js.

```bash
bun install
bun run dx    # start PostgreSQL in Docker and apply the migrations
bun run dev   # start the development server
```

Every setting is read from environment variables; see [`.env.example`](.env.example).

## 📜 License and credits

TrainTrail is free software released under the **GNU General Public License v3.0** (see [LICENSE](LICENSE)). Any copy
or fork you distribute must stay under the same license, with its source code available. See [NOTICE](NOTICE) for the
terms that apply to forks, including keeping the credits below.

TrainTrail is a modified version of **AirTrail**, a flight tracker by Johan Ohly and contributors, also released under
the GNU GPL v3: <https://github.com/johanohly/AirTrail>. See [NOTICE](NOTICE) for the exact version it is based on.

### Data sources

> [Country Borders](https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_01M_2024_4326.geojson), [NUTS Level 0 Borders](https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2024_4326_LEVL_0.geojson), and [Natural Earth Admin 0 Countries](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/)

> [EU Countries and Territories Vocabulary](https://op.europa.eu/en/web/eu-vocabularies/countries-and-territories)

> [Country Flags](https://flagpedia.net)

> [Station list](https://github.com/trainline-eu/stations) by Trainline, [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/), downloaded at first start

### Logo

The logo is from Lucide, which is a free icon pack that can be found [here](https://www.lucide.dev/).

> Copyright (c) for portions of Lucide are held by Cole Bemis 2013-present as part of Feather (MIT). All other copyright
> (c) for Lucide are held by Lucide Contributors 2026.
