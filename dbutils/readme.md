# Create new migration
```
db-migrate create <migration_name> --sql-file --migrations-dir <migration_dir>
```

# Run missing migrations
```
npm run schema:migrate
```

# Setup DB for local development
```angular2html
DB_NAME=wallets_agency schema:wallet:setupAll
DB_NAME=agency_store schema:data:setupAll
```

# Create new migration
```
db-migrate create add_foobar_table --sql-file --migrations-dir migrations_scheme_application
db-migrate create add_barbaz_index --sql-file --migrations-dir migrations_scheme_wallets
```
