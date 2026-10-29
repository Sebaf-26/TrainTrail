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
- **Import a ticket**: read a journey from the message or e-mail of your operator, a PDF ticket (Trenitalia, which gives one journey per leg, or ÖBB), an Apple Wallet pass (`.pkpass`) or a Google Wallet link, instead of typing it. PDFs are read in the browser with [pdf.js](https://mozilla.github.io/pdf.js/), and you can choose many files at once, for example a folder of tickets; the barcode of a PDF ticket is not kept. The barcode of a pass is kept with the journey, so you can show it again in its original format (Aztec, QR, PDF417 or Code 128).
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

## 🐳 Deploy with Docker

[`docker-compose.yml`](docker-compose.yml) builds TrainTrail from this repository and starts it with PostgreSQL. It
works as a Git stack in Portainer (repository URL, compose path `docker-compose.yml`) or from a terminal:

```bash
ORIGIN=https://trains.example.com DB_PASSWORD=choose-a-password docker compose up -d --build
```

- `ORIGIN` is the exact URL you open TrainTrail with; login fails if it does not match.
- `DB_PASSWORD` accepts letters and digits only. Set it before the first start: Postgres keeps the one it started with.
- `PORT` changes the port published on the host (default `8096`). Behind a reverse proxy, also set
  `ADDRESS_HEADER=X-Forwarded-For`.

Migrations, the station list and the bundled operators and trains are loaded automatically at first start.

### Real rail routes (experimental, optional)

By default a journey is drawn as a straight line between its stations. A separate service,
[OpenRailRouting](https://github.com/geofabrik/OpenRailRouting) on OpenStreetMap data, can draw it along the real
tracks instead. It does not start unless you ask for it, so it cannot block the rest of the stack:

1. Set `COMPOSE_PROFILES=routing` in the stack's environment variables (or in `.env`) and redeploy.
2. The first start downloads an OpenStreetMap extract (Italy, about 2.2 GB, unless you set `RAIL_OSM_URL` to a
   smaller region from [download.geofabrik.de](https://download.geofabrik.de)) and builds the routing graph. This takes
   a while and needs memory: the container is limited to `RAIL_MEM_LIMIT` (default 6g) and the Java heap is set with
   `RAIL_JAVA_OPTS` (default `-Xmx4g`). To try it, start with a small region.
3. A journey abroad needs the tracks of both countries. One extract covers one country, so set `RAIL_OSM_URLS` to
   several extracts separated by commas and they are merged into one (Italy 2.1 GB, Austria 0.8 GB, Switzerland
   0.5 GB, Germany 4.5 GB; France is several GB): `https://download.geofabrik.de/europe/italy-latest.osm.pbf,https://download.geofabrik.de/europe/austria-latest.osm.pbf`.
   Merging needs the free disk of the extracts twice. An extract that was already downloaded alone is kept, and
   changing the list rebuilds the graph by itself.
4. New and imported journeys are drawn along the rails in the background. For journeys you already have, open the
   journey on the map and press "Draw along the rails". If no route is found, the straight line stays.

Everything the feature does is logged with the `[rail-routing]` prefix, in the TrainTrail container and in the
`traintrail_rail_routing` one: `docker logs traintrail | grep rail-routing`.

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

> Rail routes: map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) ([ODbL](https://opendatacommons.org/licenses/odbl/1-0/)), routed with [OpenRailRouting](https://github.com/geofabrik/OpenRailRouting) by Geofabrik ([Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0))

### Logo

The logo is from Lucide, which is a free icon pack that can be found [here](https://www.lucide.dev/).

> Copyright (c) for portions of Lucide are held by Cole Bemis 2013-present as part of Feather (MIT). All other copyright
> (c) for Lucide are held by Lucide Contributors 2026.
