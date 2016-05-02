#! /bin/sh

set -e

for d in $(ls)
do
  test -d "$d" || continue
  echo "Running tests for $d"
  ( cd $d && time sh autochecker.sh )
done
