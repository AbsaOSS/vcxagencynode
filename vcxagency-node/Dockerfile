ARG AGENCY_BASE_IMAGE=vcxagency-base:1.15.0
FROM ${AGENCY_BASE_IMAGE}

USER node

WORKDIR /home/node/dbutils
COPY --chown=node:node ./dbutils ./
RUN yarn install --production

WORKDIR /home/node/easy-indysdk
COPY --chown=node:node ./easy-indysdk ./
RUN yarn install --production

WORKDIR /home/node/vcxagency-client
COPY --chown=node:node ./vcxagency-client ./

WORKDIR /home/node/vcxagency-node
COPY --chown=node:node ./vcxagency-node ./
RUN yarn install --production

USER root
RUN chown -R node:node /home/node

LABEL org.label-schema.schema-version="1.1.0"
LABEL org.label-schema.name="vcxagency-node"
LABEL org.label-schema.description="Node VCX Agency"

ENV LOG_LEVEL ${LOG_LEVEL:-'true'}
ENV LOG_ENABLE_INDYSDK ${LOG_ENABLE_INDYSDK:-'false'}
ENV LOG_JSON_TO_CONSOLE ${LOG_JSON_TO_CONSOLE:-'true'}

EXPOSE ${SERVER_PORT}

CMD ["npm", "run", "serve"]
