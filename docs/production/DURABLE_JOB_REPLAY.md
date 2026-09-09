# Reviewed durable replay

Admin diagnostics: GET /api/admin/operations/health and existing connector operations report. Review dead-letter state, oldest age, current updated_at and the provider/scope failure first. Do not include secrets or seller records in incident notes.

After correcting the cause, a signed-in administrator with fresh step-up may POST /api/admin/operations/replay with JSON: kind (billing or connector), id, expectedUpdatedAt (exact current ISO timestamp), reason (20–300 characters explaining the fix). The response is 202 queued, or 409 if the record changed, is not failed, or a connector already has an active job. Every accepted replay is audited. Replayed jobs use the existing projected receipt/checkpoint and provider verification. The scheduled outbox republishes within five minutes. No provider order creation is retried by this endpoint.

Never bulk replay a DLQ, clear payment intents, manufacture a new purchase key, or restore access from webhook status alone. Ambiguous purchase recovery uses the exact receipt lookup and keeps the purchase pending if no unique verified order is found. Keep queue/D1 evidence until the incident review finishes. Dashboard DLQ messages are evidence; the D1 record is the replay authority. Provisioning queues and production execution require the separate release gate.
