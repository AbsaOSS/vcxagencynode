Artillery Test
======

Performance/load test with Artillery
* Originated from vcxagencynode/vcxagency-client directory
* Modified for performance test with Artillery
* Use the latest NodeJS (At this point, it's lts/erbium v12.18.0)

## How to setup
```bash
yarn install
npm rebuild
```

## How to run
```bash
#
# Run ledger-pool
# Run Postgres-DB
# Run vcxagency-node
#

# Modify ./test/test-config.json for your test (set wallet count and more.)
yarn run test:00          # Create test wallets (Required once before other tests)
yarn run test:art:onbd    # Do vcx-onboarding load test w/Artillery
yarn run test:art:msg     # Do vcx-messaging load test w/Artillery
yarn run test:art:verify  # Do DID verification load test w/Artillery
```

#### Configure artillery.yaml
* Set 'config/target' to actual Angecy-url

#### Config with test-config.json
* TestName: Test wallets will have this prefix string (ex, TestName-Alice-0000)
* FaberNumber: Number of Faber(Issuer/Verifier role)
* AliceNumber: Number of Alice(Holder role)
* MaxMessagingFaberNumber: Number of message-sending-Faber
* MaxMessagingAliceNumber: Number of message-receiving-Alice
* DEBUG: `true` if you want log message
* AgencyDid: DID of Agency
* AgencyVerkey: Verkey of Agency

#### Custom Artillery metric and meaning
* Onbodarding load test (test:onbd)
  - onboarding-try: Number of valid onboarding request (request count after wallet open)
  - onboarding-ok: Number of onboarding success
  - onboarding-fail: Number of onboarding failure
* Messaging load test (test:msg)
  - Faber-total: Number of total sending messages by all Fabers
  - Alice-total: Number of total receving messages by all Alices
* Messaging load test (test:verify)
  - Faber-total: Number of total sending messages by all Fabers
  - Alice-total: Number of total receving messages by all Alices
