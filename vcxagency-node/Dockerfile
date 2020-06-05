ARG AGENCY_BASE_IMAGE=vcxagency-base:1.15.0
FROM ubuntu:16.04
RUN echo ${AGENCY_BASE_IMAGE}

FROM ${AGENCY_BASE_IMAGE} as BASE
USER root
RUN apt-get update && \
    apt-get install -y \
      curl \
      git

RUN groupadd -g 1001 app && \
    useradd -r -u 1001 -g app app

RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y nodejs

RUN npm install -g yarn

WORKDIR /home/app/easy-indysdk
COPY --chown=app:app ./easy-indysdk ./

WORKDIR /home/app/vcxagency-client
COPY --chown=app:app ./vcxagency-client ./

WORKDIR /home/app/vcxagency-node
COPY --chown=app:app ./vcxagency-node ./


RUN chown -R app:app /home/app

FROM BASE as BUILD
USER root
RUN apt-get install -y make
RUN apt-get install -y g++
RUN apt-get install -y python

USER app
WORKDIR /home/app/vcxagency-node
RUN yarn install --production

FROM BASE
USER app

WORKDIR /home/app/easy-indysdk
COPY --from=BUILD --chown=app:app /home/app/easy-indysdk/ ./

WORKDIR /home/app/vcxagency-client
COPY --from=BUILD --chown=app:app /home/app/vcxagency-client/ ./

WORKDIR /home/app/vcxagency-node
COPY --from=BUILD --chown=app:app /home/app/vcxagency-node/ ./

LABEL org.label-schema.schema-version="1.1.0"
LABEL org.label-schema.name="vcxagency-node"
LABEL org.label-schema.description="Node VCX Agency"

ENV LOG_LEVEL ${LOG_LEVEL:-'true'}
ENV LOG_ENABLE_INDYSDK ${LOG_ENABLE_INDYSDK:-'false'}
ENV LOG_JSON_TO_CONSOLE ${LOG_JSON_TO_CONSOLE:-'true'}
ENV SERVER_MAX_REQUEST_SIZE_KB ${SERVER_MAX_REQUEST_SIZE_KB:-'300'}
ENV SERVER_PORT ${SERVER_PORT}

ENV AGENCY_WALLET_NAME ${AGENCY_WALLET_NAME}
ENV AGENCY_DID ${AGENCY_DID}
ENV AGENCY_SEED_SECRET ${AGENCY_SEED_SECRET}
ENV AGENCY_WALLET_KEY_SECRET ${AGENCY_WALLET_KEY_SECRET}

ENV PG_STORE_HOST ${PG_STORE_HOST}
ENV PG_STORE_PORT ${PG_STORE_PORT}
ENV PG_STORE_ACCOUNT ${PG_STORE_ACCOUNT}
ENV PG_STORE_PASSWORD_SECRET ${PG_STORE_PASSWORD_SECRET}
ENV PG_STORE_DATABASE ${PG_STORE_DATABASE}

ENV PG_WALLET_ACCOUNT ${PG_WALLET_ACCOUNT}
ENV PG_WALLET_PASSWORD_SECRET ${PG_WALLET_PASSWORD_SECRET}
ENV PG_WALLET_ADMIN_ACCOUNT ${PG_WALLET_ADMIN_ACCOUNT}
ENV PG_WALLET_ADMIN_PASSWORD_SECRET ${PG_WALLET_ADMIN_PASSWORD_SECRET}

ENV PG_WALLET_URL ${PG_WALLET_URL}
ENV PG_WALLET_MIN_IDLE_COUNT ${PG_WALLET_MIN_IDLE_COUNT:-1}
ENV PG_WALLET_MAX_CONNECTIONS ${PG_WALLET_MAX_CONNECTIONS:-'90'}
ENV PG_WALLET_CONNECTION_TIMEOUT_MINS ${PG_WALLET_CONNECTION_TIMEOUT_MINS:-'30'}

EXPOSE ${PORT}

CMD npm run serve
