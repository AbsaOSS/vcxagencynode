export MYSQL_USER=root
export MYSQL_PASSWORD=mysecretpassword
export MYSQL_HOST=localhost
export MYSQL_PORT=3306

MYSQL_DATABASE=agency_wallets npm run schema:migrate:wallet
MYSQL_DATABASE=agency_store npm run schema:migrate:app
