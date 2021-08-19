FROM alpine:3.12 AS builder

ARG UID=1001
ARG GID=1001

ARG INDYSDK_PATH=/home/indy/vdr-tools
ARG INDYSDK_REPO=https://gitlab.com/evernym/verity/vdr-tools.git
ARG INDYSDK_REVISION=7df4c69b

ENV LC_ALL="C.UTF-8"
ENV LANG="C.UTF-8"
ENV RUST_LOG=warning

RUN addgroup -g $GID indy && adduser -u $UID -D -G indy indy

RUN apk update && apk upgrade && \
    apk add --no-cache \
        build-base \
        git \
        curl \
#        rust \
#        cargo \
        libsodium-dev \
        libzmq \
        openssl-dev \
        sqlite-dev \
        zeromq-dev

USER indy
WORKDIR /home/indy

ARG RUST_VER="1.52.0"
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain $RUST_VER --default-host x86_64-unknown-linux-musl
ENV PATH="/home/indy/.cargo/bin:$PATH" RUSTFLAGS="-C target-feature=-crt-static"

RUN git clone $INDYSDK_REPO
RUN cd $INDYSDK_PATH && git --no-pager log --decorate=short --pretty=oneline -n5
RUN cd $INDYSDK_PATH && git checkout $INDYSDK_REVISION

RUN cargo build --release --manifest-path=$INDYSDK_PATH/libindy/Cargo.toml

USER root
RUN mv $INDYSDK_PATH/libindy/target/release/libindy.so /usr/lib

FROM alpine:3.12

ARG UID=1001
ARG GID=1001

ENV LC_ALL="C.UTF-8"
ENV LANG="C.UTF-8"

RUN addgroup -g $GID node && adduser -u $UID -D -G node node

COPY --from=builder /usr/lib/libindy.so /usr/lib/

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
