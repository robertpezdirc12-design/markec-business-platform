-- F5.5.1.1 — stanje _prisma_migrations na markec_f5511_mig.
SELECT migration_name, finished_at IS NOT NULL AS applied
FROM "_prisma_migrations"
ORDER BY started_at;