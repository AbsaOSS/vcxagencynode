#!/bin/bash

SCRIPT_DIR_PATH=$(dirname "$0")

INDYSDK_REPO="https://github.com/Patrik-Stas/indy-sdk"
INDYSDK_REVISION="cc15191a75b"

DOCKER_TAG="$1"

docker build --build-arg "INDYSDK_REPO=$INDYSDK_REPO" \
             --build-arg "INDYSDK_REVISION=$INDYSDK_REVISION" \
             -t "$DOCKER_TAG" \
             -f "$SCRIPT_DIR_PATH/vcxagency-base.Dockerfile" \
             .
