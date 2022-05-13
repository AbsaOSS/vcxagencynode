#!/bin/bash

SCRIPT_DIR_PATH=$(dirname "$0")

VDRTOOLS_REPO="https://gitlab.com/evernym/verity/vdr-tools.git"
INDYSDK_REVISION="7df4c69b"
DOCKER_TAG="$1"

docker build --build-arg "VDRTOOLS_REPO=$VDRTOOLS_REPO" \
             --build-arg "INDYSDK_REVISION=$INDYSDK_REVISION" \
             -t "$DOCKER_TAG" \
             -f "$SCRIPT_DIR_PATH/vcxagency-base.Dockerfile" \
             .
