#!/bin/bash

ask_continue () {
  echo "Do you want to continue? (y/n)"
  read yesno
  if [ $yesno != "y" ]; then
    exit 0
  fi
}

SCRIPT_DIR_PATH=$(dirname "$0")

INDYSDK_REPO="https://github.com/hyperledger/indy-sdk"
INDYSDK_REVISION="1.15.0"
DOCKER_TAG="vcxagency-base:$INDYSDK_REVISION"


echo "Going to build $DOCKER_TAG from revision v$INDYSDK_REVISION at repo: $INDYSDK_REPO"

ask_continue

docker build --build-arg "INDYSDK_REPO=$INDYSDK_REPO" \
             --build-arg "INDYSDK_REVISION=v$INDYSDK_REVISION" \
             -t "$DOCKER_TAG" \
             -f "$SCRIPT_DIR_PATH/vcxagency-base.Dockerfile" \
             .

if [ "$1" == "--publish" ]; then
  if [[ -z "${DOCKER_REGISTRY}" ]]; then
    echo "You have to specify environment variable DOCKER_REGISTRY if you want to publish the image."
  fi
  REMOTE_TAG="$DOCKER_REGISTRY/$DOCKER_TAG"
  echo "Going to push image tagged as $DOCKER_TAG with remote tag $REMOTE_TAG"
  ask_continue
  docker tag  "$DOCKER_TAG" "$REMOTE_TAG"
  docker push "$REMOTE_TAG"
fi
