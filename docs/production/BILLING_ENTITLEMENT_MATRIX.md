# Billing / Entitlement Matrix

Server-owned commercial model for this hardening release:

| Offer | Price | Billing | Expected access behavior |
|---|---:|---|---|
| Free | ₹0 | none | free capabilities only |
| Action Report | ₹49 | one-time | exactly one purchased report entitlement |
| Starter | ₹99/month | recurring | Starter capabilities while provider-backed subscription is active/current |
| Pro | ₹199/month | recurring | Pro capabilities while provider-backed subscription is active/current |

Rules:
- Client never controls authoritative amount, currency, duration or capability.
- Currency is INR for these offers.
- A provider event may be replayed; business fulfilment must remain idempotent.
- Browser verification and webhook processing may arrive in either order.
- Cancellation/refund/chargeback access changes must match the published policy.
- Production pricing page and `/api/config/pricing` must be checked against this matrix before launch.
