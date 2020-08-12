FROM alpine:3.12 AS builder

ARG UID=1001
ARG GID=1001

ARG INDYSDK_PATH=/home/indy/indy-sdk
ARG INDYSDK_REPO=https://github.com/hyperledger/indy-sdk.git
ARG INDYSDK_REVISION=v1.15.0

ENV LC_ALL="C.UTF-8"
ENV LANG="C.UTF-8"
ENV RUST_LOG=warning

RUN addgroup -g $GID indy && adduser -u $UID -D -G indy indy

RUN apk update && apk upgrade && \
    apk add --no-cache \
        build-base \
        cargo \
        git \
        libsodium-dev \
        libzmq \
        openssl-dev \
        rust \
        sqlite-dev \
        zeromq-dev

USER indy
WORKDIR /home/indy

RUN git clone $INDYSDK_REPO && \
    cd indy-sdk && git checkout $INDYSDK_REVISION

RUN cargo build --release --manifest-path=$INDYSDK_PATH/libindy/Cargo.toml

USER root
RUN mv $INDYSDK_PATH/libindy/target/release/libindy.so /usr/lib

USER indy
RUN cargo build --release --manifest-path=$INDYSDK_PATH/experimental/plugins/postgres_storage/Cargo.toml

USER root
RUN mv $INDYSDK_PATH/experimental/plugins/postgres_storage/target/release/libindystrgpostgres.so /usr/lib

FROM alpine:3.12

ARG UID=1001
ARG GID=1001

ENV LC_ALL="C.UTF-8"
ENV LANG="C.UTF-8"

RUN addgroup -g $GID node && adduser -u $UID -D -G node node

COPY --from=builder /usr/lib/libindy.so /usr/lib/libindystrgpostgres.so /usr/lib/

RUN apk update && apk upgrade
RUN apk add --no-cache \
        bash \
        g++ \
        gcc \
        libsodium-dev \
        libzmq \
        make \
        nodejs \
        npm \
        openssl-dev \
        python2 \
        sqlite-dev \
        zeromq-dev

LABEL org.label-schema.schema-version="1.0"
LABEL org.label-schema.name="indy-sdk"
LABEL org.label-schema.version="${INDYSDK_REVISION}"
