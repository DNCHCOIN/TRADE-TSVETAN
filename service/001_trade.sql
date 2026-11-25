BEGIN;
CREATE SCHEMA IF NOT EXISTS trade;
REVOKE ALL ON SCHEMA trade FROM PUBLIC;
CREATE TABLE IF NOT EXISTS trade.listings (
 id uuid PRIMARY KEY, company_id uuid NOT NULL,
 title text NOT NULL, direction text NOT NULL CHECK(direction IN ('offer','wanted')),
 partnership text NOT NULL, description text NOT NULL, sector text NOT NULL,
 country text NOT NULL CHECK(country IN ('BG','CN')), region text NOT NULL, language text NOT NULL CHECK(language IN ('bg','en','zh')),
 expires_on date NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed','removed')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id)
);
CREATE INDEX IF NOT EXISTS listings_catalogue ON trade.listings(status,country,sector,expires_on);
CREATE TABLE IF NOT EXISTS trade.inquiries (
 id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES trade.listings(id), sender_id uuid NOT NULL, recipient_id uuid NOT NULL,
 subject text NOT NULL, message text NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trade.messages (
 id uuid PRIMARY KEY, inquiry_id uuid NOT NULL REFERENCES trade.inquiries(id), company_id uuid NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trade.documents (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, kind text NOT NULL, parent_id uuid NOT NULL,
 name text NOT NULL,mime text NOT NULL,size integer NOT NULL CHECK(size>0 AND size<=5242880),sha256 text NOT NULL,storage_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'quarantined' CHECK(status IN ('quarantined','reviewed','rejected')),
 visibility text NOT NULL DEFAULT 'company' CHECK(visibility IN ('company','registered')),
 review_note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(parent_id,company_id) REFERENCES trade.listings(id,company_id)
);
CREATE TABLE IF NOT EXISTS trade.audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,company_id uuid NOT NULL,actor_id uuid NOT NULL,action text NOT NULL,entity_id uuid,created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION trade.tenant() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('app.organization_id',true),'')::uuid$$;
ALTER TABLE trade.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade.audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listing_read ON trade.listings;
DROP POLICY IF EXISTS listing_write ON trade.listings;
CREATE POLICY listing_read ON trade.listings FOR SELECT USING(company_id=trade.tenant() OR (status='published' AND expires_on>=CURRENT_DATE));
CREATE POLICY listing_write ON trade.listings FOR ALL USING(company_id=trade.tenant()) WITH CHECK(company_id=trade.tenant());
DROP POLICY IF EXISTS inquiry_scope ON trade.inquiries;
CREATE POLICY inquiry_scope ON trade.inquiries USING(sender_id=trade.tenant() OR recipient_id=trade.tenant()) WITH CHECK(sender_id=trade.tenant() OR recipient_id=trade.tenant());
DROP POLICY IF EXISTS message_scope ON trade.messages;
CREATE POLICY message_scope ON trade.messages USING(EXISTS(SELECT 1 FROM trade.inquiries i WHERE i.id=inquiry_id AND (i.sender_id=trade.tenant() OR i.recipient_id=trade.tenant()))) WITH CHECK(company_id=trade.tenant() AND EXISTS(SELECT 1 FROM trade.inquiries i WHERE i.id=inquiry_id AND (i.sender_id=trade.tenant() OR i.recipient_id=trade.tenant())));
DROP POLICY IF EXISTS document_scope ON trade.documents;
CREATE POLICY document_scope ON trade.documents USING(company_id=trade.tenant() OR current_setting('app.document_reviewer',true)='on') WITH CHECK(company_id=trade.tenant() OR current_setting('app.document_reviewer',true)='on');
DROP POLICY IF EXISTS audit_scope ON trade.audit;
CREATE POLICY audit_scope ON trade.audit USING(company_id=trade.tenant()) WITH CHECK(company_id=trade.tenant());
REVOKE ALL ON ALL TABLES IN SCHEMA trade FROM PUBLIC;
COMMIT;
