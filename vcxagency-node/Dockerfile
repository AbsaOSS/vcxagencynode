ARG AGENCY_BASE_IMAGE
FROM ${AGENCY_BASE_IMAGE}

RUN apk add --no-cache \
        npm \
        bash \
        g++ \
        gcc \
        make \
        cmake \
        python2 \
        curl

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

CMD ["npm", "run", "serve"]
