# backend/ — reserved for the Live Message Bridge

The current prototype runs in the frontend. The bridge is planned.

This directory is reserved for a **minimal** integration bridge whose only jobs are:

- **WhatsApp inbound** — WhatsApp Cloud API webhook (signature-verified)
- **Outlook Email inbound** — Microsoft Graph, delegated read-only mailbox access
- **Telegram inbound** — Bot API long polling
- **Message normalisation** — one channel-independent inbound message event
- **Secure provider credentials** — tokens stay server-side, never in the frontend bundle or repository
- **Message delivery to the frontend** — deduplicated events pushed to the web app

It will **not** contain recovery, inventory, optimisation or other business logic; those run in the frontend
against synthetic data. See the [P2 integration notes](../docs/development/P2_impact_foundation.md).

No API routes, mock handlers, authentication shortcuts, database models or dependencies exist yet.
