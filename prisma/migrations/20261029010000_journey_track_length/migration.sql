-- AlterTable
ALTER TABLE "journey_track" ADD COLUMN "length_m" DOUBLE PRECISION;

-- Routes already drawn along the rails get their length: the sum of the
-- great-circle distances between consecutive points.
UPDATE "journey_track" AS jt
SET "length_m" = lengths."length"
FROM (
  SELECT "journey_id", sum("segment") AS "length"
  FROM (
    SELECT
      "journey_id",
      2 * 6371000 * asin(least(1, sqrt(
        power(sin(radians("lat" - "prev_lat") / 2), 2) +
        cos(radians("prev_lat")) * cos(radians("lat")) *
          power(sin(radians("lon" - "prev_lon") / 2), 2)
      ))) AS "segment"
    FROM (
      SELECT
        t."journey_id",
        (c."point" ->> 0)::float8 AS "lon",
        (c."point" ->> 1)::float8 AS "lat",
        lag((c."point" ->> 0)::float8) OVER w AS "prev_lon",
        lag((c."point" ->> 1)::float8) OVER w AS "prev_lat"
      FROM "journey_track" AS t,
        jsonb_array_elements(t."track" -> 'coordinates') WITH ORDINALITY AS c("point", "position")
      WHERE t."source_format" = 'rail'
      WINDOW w AS (PARTITION BY t."journey_id" ORDER BY c."position")
    ) AS points
    WHERE "prev_lon" IS NOT NULL
  ) AS segments
  GROUP BY "journey_id"
) AS lengths
WHERE jt."journey_id" = lengths."journey_id";
