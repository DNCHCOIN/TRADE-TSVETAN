# TRADE business service — private development

Owns the separate `dnch_trade` database. Loaded by BUSINESS HUB `platform/src/server.mjs` with trusted authentication/tenant helpers. No passwords, identity tables or CASPIAN business records are stored here.

`001_trade.sql`: owner-scoped listings, inquiries/messages, protected document metadata and audit. APIs: catalogue/filtering, own create/edit/soft-delete, expiry and optimistic version checks, verified-company inquiries and replies. Guests receive product information only; server-side serialization excludes company/contact data. Publication and contact access require manual company verification in identity. A changed/suspended legal identity is excluded from the public catalogue.

Private staging browser is served by the shared host. The original root files remain the public demo and are available at `/preview` locally. No localStorage demo record is imported automatically into the business database.

Validation is coordinated in HUB `platform/test/integration.mjs`. Current release and gaps: HUB `platform/README.md`. Catalogue documents are private in this iteration; registered-party publication/download permission needs its own tested release. Customer acceptance and public production access are not claimed.
