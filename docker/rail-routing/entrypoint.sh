#!/bin/sh
# Gets the OSM extract (or several, merged into one), builds the routing graph
# from it on the first start (or when the extracts or the configuration
# changed) and then serves the routing API on port 8989.
set -eu

DATA=/data
PBF="$DATA/extract.osm.pbf"
SOURCES="$DATA/sources"
GRAPH="$DATA/graph-cache"
STAMP="$DATA/graph.stamp"

# Every line carries the prefix, so `docker logs ... | grep rail-routing` and a
# pasted log tell what happened and when.
log() {
  echo "[rail-routing] $(date -u '+%Y-%m-%d %H:%M:%S') $*"
}
size() {
  du -sh "$1" 2>/dev/null | cut -f1
}
free_disk() {
  df -h "$DATA" 2>/dev/null | tail -1 | awk '{print $4}'
}

# One extract in RAIL_OSM_URL, or several to merge in RAIL_OSM_URLS (separated
# by commas or spaces): a journey abroad needs the tracks of both countries.
URLS="$(printf '%s' "${RAIL_OSM_URLS:-}" | tr ',\n\t' '   ' | tr -s ' ' | sed 's/^ //; s/ $//')"
if [ -z "$URLS" ]; then
  URLS="$(printf '%s' "${RAIL_OSM_URL:-}" | tr -s ' ' | sed 's/^ //; s/ $//')"
fi
if [ -z "$URLS" ]; then
  log "no extract to route on: set RAIL_OSM_URL (one) or RAIL_OSM_URLS (several)"
  exit 1
fi
set -f
# shellcheck disable=SC2086
set -- $URLS
set +f
COUNT=$#

memory_limit="$(cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo unknown)"
log "starting: $COUNT extract(s): $URLS"
log "java options: ${RAIL_JAVA_OPTS:-}"
log "container memory limit: $memory_limit bytes (max)"
log "cpus: $(nproc 2>/dev/null || echo unknown), free disk on $DATA: $(free_disk)"

mkdir -p "$DATA"

# The name a downloaded extract is kept under, e.g. 2-austria-latest.osm.pbf.
source_file() {
  name="$(basename "${2%%\?*}")"
  echo "$SOURCES/$1-$name"
}

# Downloads $1 to $2, as one line of log every 30 seconds instead of curl's
# progress meter, which redraws one line with carriage returns and turns a
# container log into an unreadable mess. A partial file is continued if the
# container restarts. A file:// URL (a file mounted into the container) is copied.
fetch() {
  log "downloading $1"
  started="$(date +%s)"
  case "$1" in
    file://*)
      cp "${1#file://}" "$2.part"
      ;;
    *)
      curl -fL --silent --show-error -C - --retry 5 --retry-delay 15 --retry-all-errors \
        -o "$2.part" "$1" &
      curl_pid=$!
      while kill -0 "$curl_pid" 2>/dev/null; do
        sleep 30
        if kill -0 "$curl_pid" 2>/dev/null; then
          log "downloading... $(size "$2.part") so far, $(($(date +%s) - started)) s elapsed"
        fi
      done
      wait "$curl_pid"
      ;;
  esac
  mv "$2.part" "$2"
  log "downloaded $(basename "$2") ($(size "$2")) in $(($(date +%s) - started)) s"
}

# Other extracts than last time: fetch them and build the graph again. An
# extract that was downloaded alone is kept when it is one of the new ones.
if [ -f "$DATA/source.url" ] && [ "$(cat "$DATA/source.url")" != "$URLS" ]; then
  previous="$(cat "$DATA/source.url")"
  log "the extracts changed (were: $previous): rebuilding the graph"
  if [ -s "$PBF" ] && [ "${previous#* }" = "$previous" ]; then
    index=0
    for url in $URLS; do
      index=$((index + 1))
      if [ "$url" = "$previous" ] && [ "$COUNT" -gt 1 ]; then
        mkdir -p "$SOURCES"
        mv "$PBF" "$(source_file "$index" "$url")"
        log "keeping the extract already downloaded: $url"
      fi
    done
  fi
  rm -rf "$PBF" "$PBF.part" "$GRAPH" "$STAMP"
  [ "$COUNT" -gt 1 ] || rm -rf "$SOURCES"
fi

if [ -s "$PBF" ]; then
  log "extract already present: $(size "$PBF")"
elif [ "$COUNT" -eq 1 ]; then
  fetch "$1" "$PBF"
  echo "$URLS" > "$DATA/source.url"
else
  mkdir -p "$SOURCES"
  index=0
  files=""
  for url in $URLS; do
    index=$((index + 1))
    file="$(source_file "$index" "$url")"
    if [ -s "$file" ]; then
      log "already downloaded: $(basename "$file") ($(size "$file"))"
    else
      fetch "$url" "$file"
    fi
    files="$files $file"
  done

  log "merging $COUNT extracts into one (free disk: $(free_disk))"
  started="$(date +%s)"
  # shellcheck disable=SC2086
  osmium merge --overwrite -f pbf -o "$PBF.part" $files
  mv "$PBF.part" "$PBF"
  echo "$URLS" > "$DATA/source.url"
  log "merged into $(size "$PBF") in $(($(date +%s) - started)) s"
  rm -rf "$SOURCES"
  log "removed the separate extracts (free disk: $(free_disk))"
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
