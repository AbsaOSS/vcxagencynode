# Configuration options
You can see sample configuration, default for running agency locally [here](./config/localhost.env).

### Core
- `SERVER_PORT` - Example value `8080`, port on which agency should listen on.
- `SERVER_MAX_REQUEST_SIZE_KB` - Maximum allowed size of accepted HTTP request. 
- `AGENCY_DID` - 22 alphanumeric characters identifying agency.
- `AGENCY_SEED_SECRET` - 32 alphanumeric characters used during first startup to derive public and private key of agency.
- `AGENCY_WALLET_NAME` - Name of the agency wallet.
- `AGENCY_WALLET_KEY_SECRET` - Value used as input into ARGON2I_MOD key derivation. The output is used to unlock 
   the agency wallet.

### Logging
- `LOG_LEVEL` - Valid values: `error, warn, info, debug, silly`.
- `LOG_ENABLE_INDYSDK` - Valid values: `true, false`, enables/disables IndySDK logs.
- `LOG_JSON_TO_CONSOLE` - Valid values: `true, false`, if enabled logs as json, if disable produces color logs.

### Application pgsql storage
Following options configure pgsql for managing agency's custom storage - this stores messages, information about agents,
connections, etc.

- `PG_STORE_HOST` - Hostname of pgsql database, example value: `localhost`.
- `PG_STORE_PORT` - Port of pgsql database, example value: `5432`.
- `PG_STORE_DATABASE` - Name of pgsql database, example value: `agency-storage`.
- `PG_STORE_ACCOUNT` - Username to use for read/write access, example value: `postgres`.
- `PG_STORE_PASSWORD_SECRET` - Password for specified username, example: `mysecretpassword`.

### Wallet pgsql storage access
Following options configure pgsql for storing wallets.

- `PG_WALLET_URL` Host and port running pgsql, example value: `localhost:5432`.
- `PG_WALLET_ACCOUNT` - Username to access wallets for read/write, example value: `postgres`.
- `PG_WALLET_PASSWORD_SECRET` - Password for username `<PG_WALLET_ACCOUNT>`.
- `PG_WALLET_ADMIN_ACCOUNT` - Username to create databases and tables in postgres. If you are certain no new databases 
   or tables will be greated during the run of agency, this option can be omitted. Necessary to supply at first run.
- `PG_WALLET_ADMIN_PASSWORD_SECRET` - Password for username `<PG_WALLET_ADMIN_ACCOUNT>`.

### Wallet pgsql storage options
- `PG_WALLET_MAX_CONNECTIONS` - Sets the maximum number of connections managed by the pool. Example value `90`.
- `PG_WALLET_CONNECTION_TIMEOUT_MINS` - Sets the idle timeout used by the pool. Example value `30`.

### Todo: 
- Add option to specify pgsql wallets database. Will require adding support to do that 
  for `MultiWalletSingleTableStrategySharedPool` strategy on pgsql plugin level in rust.
 
