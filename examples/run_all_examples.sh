#! /bin/sh

for d in $(ls)
do
  test -d "$d" || continue
  echo "Running tests for $d"
  ( cd $d && sh autochecker.sh )
done
