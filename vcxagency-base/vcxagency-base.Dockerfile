FROM alpine:3.15.4 AS LIBINDY_BUILD

ARG UID=1001
ARG GID=1001

ARG VDRTOOLS_PATH=/home/indy/vdr-tools
ARG VDRTOOLS_REPO=https://gitlab.com/evernym/verity/vdr-tools.git
ARG VDRTOOLS_REVISION=7df4c69b

ENV LC_ALL="C.UTF-8"
ENV LANG="C.UTF-8"
ENV RUST_LOG=warning

RUN addgroup -g $GID indy && adduser -u $UID -D -G indy indy

RUN apk update && apk upgrade && \
    apk add --no-cache \
        build-base \
        git \
        curl \
        libsodium-dev \
        libzmq \
        openssl-dev \
        zeromq-dev \
        sqlite-dev

USER indy
WORKDIR /home/indy

ARG RUST_VER="1.52.0"
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain $RUST_VER --default-host x86_64-unknown-linux-musl
ENV PATH="/home/indy/.cargo/bin:$PATH" RUSTFLAGS="-C target-feature=-crt-static"

RUN git clone $VDRTOOLS_REPO
RUN cd $VDRTOOLS_PATH && git --no-pager log --decorate=short --pretty=oneline -n5
RUN cd $VDRTOOLS_PATH && git checkout $VDRTOOLS_REVISION

RUN cargo build --release --manifest-path=$VDRTOOLS_PATH/libindy/Cargo.toml

USER root
RUN mv $VDRTOOLS_PATH/libindy/target/release/libindy.so /usr/lib

FROM alpine:3.15.4

ARG UID=1001
ARG GID=1001

ENV LANG="C.UTF-8"
ENV LC_ALL="C.UTF-8"

RUN addgroup -g $GID node && adduser -u $UID -D -G node node

COPY --from=LIBINDY_BUILD /usr/lib/libindy.so /usr/lib/

RUN apk update && apk upgrade
RUN apk add --no-cache \
        bash \
        g++ \
        gcc \
        libsodium-dev \
        libzmq \
        make \
        cmake \
        npm \
        openssl-dev \
        python3 \
        sqlite-dev \
        zeromq-dev

RUN echo 'https://dl-cdn.alpinelinux.org/alpine/v3.12/main' >> /etc/apk/repositories
RUN apk add --no-cache nodejs=12.22.12-r0

LABEL org.label-schema.schema-version="1.0"
LABEL org.label-schema.name="indy-sdk"
LABEL org.label-schema.version="${VDRTOOLS_REVISION}"
