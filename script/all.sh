#!/bin/sh

script/clean.sh || exit
script/build-electron.sh || exit
script/build-server.sh || exit

