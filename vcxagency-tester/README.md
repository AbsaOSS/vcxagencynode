# LibVCX Agency tester
Contains integration tests using LibVCX library.

# How to use
- Install dependencies running `yarn install`. *Important: You have to use Node 8.* This is due to issues with FFI 
library dependency (https://github.com/node-ffi/node-ffi/issues/545). Tip: use [NVM](https://github.com/nvm-sh/nvm) 
to switch between different NodeJS versions.
- Start up any LibVCX compatible Agency supporting LibVCX V3 protocol. To see how to startup Node VCX Agency
  see instructions [here](../vcxagency-node).
- Run integrations test `yarn run test:integration`


