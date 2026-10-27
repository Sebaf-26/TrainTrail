# TrainTrail Data

Reference data that ships with TrainTrail.

## Contents

- `operators.json`: railway operators (`id`, `name`, optional short `code`, optional `defunct`).
- `trains.json`: train models and series (`id`, `name`, optional model `code`).

Both lists are the default content of new installations. They are bundled with the app, so
existing installations pick up new entries by updating TrainTrail and running
`Settings -> Data -> [Operators | Trains] -> Sync`. Entries you add yourself are never overwritten.

The lists are a starting point and are deliberately not exhaustive: add anything missing from
`Settings -> Data`.

Run `bun run data:format` to sort and format the files and `bun run data:validate` to check them.

## Stations

Stations are not stored here. On first start TrainTrail downloads the station list published by
[trainline-eu/stations](https://github.com/trainline-eu/stations) (Open Database License 1.0) and
keeps the railway stations. Use `Settings -> Data -> Stations -> Sync` to refresh it.
