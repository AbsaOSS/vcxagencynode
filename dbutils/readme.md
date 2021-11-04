# Run migrations
You have to make sure to setup environment variables `MYSQL_DATABASE`, `MYSQL_USER`,
`MYSQL_PASSWORD`, `MYSQL_HOST`, `MYSQL_PORT` before running following commands
```
npm run schema:migrate:wallet
```
```
npm run schema:migrate:app
```

# Run migrations in dev environment
- Assuming you are running mysql on port `localhost:3306`
```
npm run dev:schema:migrate:all
```

# Create new migration
- New application schema migration
```
db-migrate create <migration_name> --sql-file --migrations-dir migrations_scheme_application
```
- New wallet schema migration
```
db-migrate create <migration_name> --sql-file --migrations-dir migrations_scheme_wallets
```
