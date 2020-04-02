#!/bin/bash

ask_continue () {
  echo "Do you want to continue? (y/n)"
  read yesno
  if [[ $yesno != "y" ]]; then
    exit 0
  fi
}

print_usage () {
  echo 'ERROR: Usage: ./dockerbuild.sh "IMAGE_NAME" [(-b|--build-context) "BUILD_CONTEXT"] [(-p|--push)] [(-y|--yes)]'
}

IMAGE_NAME=$1; shift;
IMAGE_VERSION=`cat ${IMAGE_NAME}/package.json | jq -r '.version'`

DOCKER_TAG="$IMAGE_NAME:$IMAGE_VERSION"

BUILD_CONTEXT=
SKIP_CONFIRM=
PUSH=

while [[ "$#" -gt 0 ]]; do case $1 in
  -y|--yes) SKIP_CONFIRM=1;;
  -p|--push) PUSH=1;;
  -b|--build-context) BUILD_CONTEXT=$2; shift;;
  *) echo "Invalid option: $1"; print_usage; exit 1;;
esac; shift; done

if [[ -z $BUILD_CONTEXT ]]; then BUILD_CONTEXT=./$IMAGE_NAME; fi

echo "Script PWD: ${PWD}"
echo "Going to build the following docker image:"
echo "tag: $DOCKER_TAG"
echo "dockerfile: $BUILD_CONTEXT/Dockerfile"
echo "context: $BUILD_CONTEXT"

if [[ -z $SKIP_CONFIRM ]]; then ask_continue; fi

docker build -t "$DOCKER_TAG" \
             -f "$IMAGE_NAME/Dockerfile" \
             $BUILD_CONTEXT

if [[ $PUSH -eq 1 ]]; then
  if [[ -z "${REGISTRY_URL}" ]]; then
    echo "You have to specify environment variable REGISTRY_URL if you want to publish the image."
  fi
  REMOTE_TAG="$REGISTRY_URL/$DOCKER_TAG"
  echo "Going to tag image $DOCKER_TAG as $REMOTE_TAG and push to $REGISTRY_URL."
  if [[ -z $SKIP_CONFIRM ]]; then ask_continue; fi
  docker tag  "$DOCKER_TAG" "$REMOTE_TAG"
  docker push "$REMOTE_TAG"
fi
