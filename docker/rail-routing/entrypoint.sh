#!/bin/sh
# Downloads the OSM extract if it is missing, builds the routing graph from it
# on the first start (or when the extract or the configuration changed) and
# then serves the routing API on port 8989.
set -eu

DATA=/data
PBF="$DATA/extract.osm.pbf"
GRAPH="$DATA/graph-cache"
STAMP="$DATA/graph.stamp"
URL="${RAIL_OSM_URL:?Set RAIL_OSM_URL to the .osm.pbf extract to route on}"

# Every line carries the prefix, so `docker logs ... | grep rail-routing` and a
# pasted log tell what happened and when.
log() {
  echo "[rail-routing] $(date -u '+%Y-%m-%d %H:%M:%S') $*"
}
size() {
  du -sh "$1" 2>/dev/null | cut -f1
}

memory_limit="$(cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo unknown)"
log "starting: extract=$URL"
log "java options: ${RAIL_JAVA_OPTS:-}"
log "container memory limit: $memory_limit bytes (max)"
log "cpus: $(nproc 2>/dev/null || echo unknown), free disk on $DATA: $(df -h "$DATA" 2>/dev/null | tail -1 | awk '{print $4}')"

mkdir -p "$DATA"

# A different URL means a different extract: fetch it and build the graph again.
if [ -f "$DATA/source.url" ] && [ "$(cat "$DATA/source.url")" != "$URL" ]; then
  log "the extract changed (was $(cat "$DATA/source.url")): downloading it again and rebuilding the graph"
  rm -rf "$PBF" "$GRAPH" "$STAMP"
fi

if [ ! -s "$PBF" ]; then
  log "downloading $URL"
  started="$(date +%s)"
  curl -fL --retry 5 --retry-delay 15 --retry-all-errors -o "$PBF.part" "$URL"
  mv "$PBF.part" "$PBF"
  echo "$URL" > "$DATA/source.url"
  log "downloaded $(size "$PBF") in $(($(date +%s) - started)) s"
else
  log "extract already present: $(size "$PBF")"
fi

# The graph depends on the configuration and the models: rebuild when they change.
CONFIG_SUM="$(cat /app/config.yml /app/custom_models/*.json | cksum)"
if [ -d "$GRAPH" ] && [ "$(cat "$STAMP" 2>/dev/null)" != "$CONFIG_SUM" ]; then
  log "the routing configuration changed: rebuilding the graph"
  rm -rf "$GRAPH"
fi
echo "$CONFIG_SUM" > "$STAMP"

if [ -d "$GRAPH" ]; then
  log "graph found ($(size "$GRAPH")): serving without importing"
else
  log "no graph yet: importing the extract now. This can take a long time and needs memory; if the container is killed, raise RAIL_MEM_LIMIT / RAIL_JAVA_OPTS or use a smaller extract"
fi

# GraphHopper imports the extract by itself when there is no graph yet.
# Settings are passed with the dw. prefix, as the dropwizard server wants.
log "launching the routing engine on port 8989"
# shellcheck disable=SC2086
exec java ${RAIL_JAVA_OPTS:-} \
  -Ddw.graphhopper.datareader.file="$PBF" \
  -Ddw.graphhopper.graph.location="$GRAPH" \
  -jar /app/railway_routing.jar serve /app/config.yml
