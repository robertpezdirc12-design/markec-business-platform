Set-Item -Path Env:DATABASE_URL -Value 'postgresql://postgres:postgres@localhost:5432/markec_f21_test?schema=public'
node scripts/f221-browser-flow.cjs
exit $LASTEXITCODE