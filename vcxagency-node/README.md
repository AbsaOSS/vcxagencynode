# Node VCX Agency
- Implementation of [LibVCX](https://github.com/hyperledger/indy-sdk/tree/master/vcx) (V3 protocol) compatible Agency (more specifically 
[Mediator Agency](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0046-mediators-and-relays/README.md)
in Aries terminology).

# How to run it
You can run agency locally. It's recommended to run with Node v12. (Tip: use [NVM](https://github.com/nvm-sh/nvm) 
to switch manage different NodeJS versions.)

- If you don't have already, install yarn on your system
```shell script
npm install -g yarn
```

- Install dependencies
```shell script
yarn install
```

- Prepare postgres database somewhere. You can run it locally in docker like this:
```shell script
docker run --name postgres \ 
            -v pgdata:/var/lib/postgresql/data \
            -e POSTGRES_PASSWORD=mysecretpassword \
            -d -p 5432:5432 postgres
```

- Make sure you have built IndySDK [pgsql wallet plugin](https://github.com/hyperledger/indy-sdk/tree/master/experimental/plugins/postgres_storage)
and make sure it's in your system's library directory (`/usr/local/lib` for Mac, `/usr/lib` for Linux).

- Finally, run agency:
```shell script
yarn run 
```
- You can also customize default agency [configuration](./config/localhost.env). You can find description of 
all configuration options [here ](./configuration.md).

# Running in docker
To build agency image, you [first need to build base image](../ubuntu-indysdk-lite) `ubuntu-indysdk-lite` it 
depends on. Once you have done that, build agency image:
```shell script
yarn run docker:build
```
 

# Testing
## Unit testing
- Many unit tests expect pgsql running (you could argue it's therefore integration test from some perspective). 

  Start it like this:
```shell script
docker run --name postgres \ 
            -v pgdata:/var/lib/postgresql/data \
            -e POSTGRES_PASSWORD=mysecretpassword \
            -d -p 5432:5432 postgres
```
Run tests
```shell script
yarn test:unit
```
- While many of the unit tests are testing only small fraction of code, it worth noting there's a portion of them which 
serves like fast grey-box integration tests without networking in `./test/unit/entities`. These tests are using
[VCX Agency Client](../vcxagency-client) to construct encrypted messages as if they were sent over wire. But
in the tests they are passed to agency through memory, instead of being sent over network.

## Integration testing over network
- First startup the agency as described in instructions `How to run it`. Now you can use [VCX Tester](../vcx-tester)
which is using LibVCX library to perform operations against the agency. In terms of this project, this can be
considered almost as E2E test. It can be run against any VCX Agency implementation.

- While LibVCX library itself serves as client of the agency, [NodeJS VCX Client](../vcxagency-client) 
gives ability to perform more granular operations against agency - mostly for testing, development, experiments.
Its tests can be used against any VCX Agency implementation. 
 

# Dev
- The agency exposes HTTP APIs to communicate with LibVCX client configured to use protocol V3 (in LibVCX versions
older than 1.15.0, that's V2 with Aries enabled). 
- The exposed API expects to receive HTTP POST requests with `application/ssi-agent-wire` content type. You can't
easily use something like postman to experiment. Instead, for making particular requests against agency, use 
[VCX Agency Client](../vcxagency-client) we've built. It can be used to make requests against any LibVCX compliant
agency. Check out its integration tests for quick working example. 
- If you want to explore agency code, it will be useful to get this [overview](./dev.md) a read.

# Notes
- The project is using forked version of FFI to load up pgsql wallet plugin. The reason being, original `ffi`
package does not support Node 10 or Node 12, but this forked version `@saleae/ffi` does. See more info here
https://github.com/node-ffi/node-ffi/issues/545
