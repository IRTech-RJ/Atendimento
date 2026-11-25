UPDATE companies
SET trial_started_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    trial_ends_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+15 days'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE trial_started_at IS NULL
  AND id IN (
    SELECT tenant_id FROM whatsapp_accounts
    UNION
    SELECT tenant_id FROM telegram_accounts
  );
