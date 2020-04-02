#!/bin/bash

ask_continue () {
  echo "Do you want to continue? (y/n)"
  read yesno
  if [ $yesno != "y" ]; then
    exit 0
  fi
}

SCRIPT_DIR_PATH=$(dirname "$0")

INDYSDK_REPO_OWNER="hyperledger"
INDYSDK_REVISION="1.15.0"
NAME="pgsql"

DOCKER_TAG="ubuntu-indysdk-lite:$INDYSDK_REVISION"
if [[ "$NAME" ]]; then
  DOCKER_TAG="$DOCKER_TAG-$NAME"
fi;

INDYSDK_REPO="https://github.com/${INDYSDK_REPO_OWNER}/indy-sdk"

echo "Going to build $DOCKER_TAG from revision v$INDYSDK_REVISION at repo: $INDYSDK_REPO"

ask_continue

docker build --build-arg "INDYSDK_REPO=$INDYSDK_REPO" \
             --build-arg "INDYSDK_REVISION=v$INDYSDK_REVISION" \
             -t "$DOCKER_TAG" \
             -f "$SCRIPT_DIR_PATH/Dockerfile" \
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
