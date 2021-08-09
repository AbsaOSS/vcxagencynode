#!/bin/bash

SCRIPT_DIR_PATH=$(dirname "$0")

INDYSDK_REPO=https://gitlab.com/PatrikStas/vdr-tools.git
INDYSDK_REVISION=963c6c287
DOCKER_TAG="$1"

=/home/indy/vdr-tools
=https://gitlab.com/PatrikStas/vdr-tools.git
=963c6c287

docker build --build-arg "INDYSDK_REPO=$INDYSDK_REPO" \
             --build-arg "INDYSDK_REVISION=v$INDYSDK_REVISION" \
             -t "$DOCKER_TAG" \
             -f "$SCRIPT_DIR_PATH/vcxagency-base.Dockerfile" \
             .
