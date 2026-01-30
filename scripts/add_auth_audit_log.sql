-- Add Auth Audit Log for security events
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    email TEXT,
    event_type TEXT NOT NULL, -- 'password_reset_request', 'password_reset_success', 'password_reset_failure'
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying logs
CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_email ON auth_audit_log(email);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event ON auth_audit_log(event_type);

-- RLS (Admin only or system only)
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON auth_audit_log;
CREATE POLICY "Admins can view audit logs" ON auth_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
