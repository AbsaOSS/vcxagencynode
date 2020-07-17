#!/bin/bash

SCRIPT_DIR_PATH=$(dirname "$0")

INDYSDK_REPO="https://github.com/hyperledger/indy-sdk"
INDYSDK_REVISION="1.15.0"
DOCKER_TAG="$1"

docker build --build-arg "INDYSDK_REPO=$INDYSDK_REPO" \
             --build-arg "INDYSDK_REVISION=v$INDYSDK_REVISION" \
             -t "$DOCKER_TAG" \
             -f "$SCRIPT_DIR_PATH/vcxagency-base.Dockerfile" \
             .
