export MYSQL_USER=root
export MYSQL_PASSWORD=mysecretpassword
export MYSQL_HOST=localhost
export MYSQL_PORT=3306

MYSQL_DATABASE=wallets_agency npm run schema-wallet:migrate
MYSQL_DATABASE=agency_store npm run schema-data:migrate
