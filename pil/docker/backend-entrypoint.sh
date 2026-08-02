#!/bin/sh
set -e

# Railway (and most platforms) mount an attached volume as root-owned at container
# start, overwriting whatever ownership the image had at build time for that path
# — so the build-time `chown` in the Dockerfile is not enough once a real volume is
# attached at /data. Fix ownership here, as root, before dropping to the unprivileged
# app user to actually run the server.
mkdir -p /data/storage
chown -R app:app /data

exec su -s /bin/sh app -c "$*"
