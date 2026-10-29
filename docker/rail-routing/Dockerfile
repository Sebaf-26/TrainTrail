# OpenRailRouting (Geofabrik), built from a pinned commit, as an optional
# service for TrainTrail: it routes between two stations along the real
# tracks of OpenStreetMap. It runs on amd64 and arm64.
FROM maven:3.9-eclipse-temurin-17 AS build
# v1.2 of https://github.com/geofabrik/OpenRailRouting
ARG ORR_REF=e5112194fde4cc8ec36e2b0093e250df89ef4845
WORKDIR /src
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*
# Only the source is needed: the doc/api submodule is documentation.
RUN git init -q . \
 && git remote add origin https://github.com/geofabrik/OpenRailRouting.git \
 && git fetch -q --depth 1 origin "$ORR_REF" \
 && git checkout -q FETCH_HEAD
# The Maven cache survives a failed build, so a flaky network only costs a retry.
# Timeouts make a stalled download fail, and the loop retries it: the jar of
# graphhopper-web (47 MB) only exists on maven.geofabrik.de, and a dropped
# connection there fails the whole build otherwise.
RUN --mount=type=cache,target=/root/.m2 \
    for attempt in 1 2 3 4; do \
      mvn -B -DskipTests \
        -Dmaven.wagon.http.retryHandler.count=5 \
        -Daether.connector.connectTimeout=30000 \
        -Daether.connector.requestTimeout=300000 \
        package && break; \
      echo "Maven failed (attempt $attempt), retrying"; \
      [ "$attempt" = 4 ] && exit 1; \
    done \
 && cp target/railway_routing-*.jar /railway_routing.jar

FROM eclipse-temurin:17-jre
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates osmium-tool \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /railway_routing.jar /app/railway_routing.jar
COPY docker/rail-routing/config.yml /app/config.yml
COPY docker/rail-routing/custom_models /app/custom_models
COPY docker/rail-routing/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# The OSM extract and the graph built from it live here: mount a volume.
VOLUME /data
ENV RAIL_OSM_URL=https://download.geofabrik.de/europe/italy-latest.osm.pbf \
    RAIL_OSM_URLS="" \
    RAIL_JAVA_OPTS="-Xmx4g -Xms256m"
EXPOSE 8989
# Importing a country takes a while the first time, hence the long start period.
HEALTHCHECK --interval=1m --timeout=10s --start-period=60m --retries=3 \
  CMD curl -fsS http://localhost:8989/health || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
