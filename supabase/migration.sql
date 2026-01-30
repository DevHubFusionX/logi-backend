-- =============================================
-- LOGISTICS PLATFORM DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    client_category TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'driver')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add columns if they don't exist (for existing tables)
DO $$
BEGIN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_category TEXT;
END $$;

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email, 
        first_name, 
        last_name,
        company_name,
        client_category,
        phone
    )
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'company_name',
        NEW.raw_user_meta_data->>'client_category',
        NEW.raw_user_meta_data->>'phone'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ADDRESSES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    label TEXT, -- 'Home', 'Office', etc.
    street TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Lagos',
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'USA',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- =============================================
-- VEHICLES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    plate_number TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'van' CHECK (type IN ('van', 'truck', 'motorcycle', 'car')),
    capacity_kg DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    is_assigned BOOLEAN DEFAULT false,
    assigned_driver_id UUID,
    last_maintenance TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DRIVERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    license_number TEXT UNIQUE NOT NULL,
    license_expiry DATE,
    vehicle_id UUID REFERENCES vehicles(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'on_delivery')),
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    suspension_reason TEXT,
    suspended_at TIMESTAMPTZ,
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    last_location_update TIMESTAMPTZ,
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_deliveries INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_user ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- Safely add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vehicle_driver') THEN
        ALTER TABLE vehicles ADD CONSTRAINT fk_vehicle_driver 
            FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- SHIPMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_number TEXT UNIQUE NOT NULL,
    sender_id UUID REFERENCES profiles(id),
    driver_id UUID REFERENCES drivers(id),
    
    -- Origin
    origin TEXT NOT NULL DEFAULT 'Lagos',
    origin_lat DECIMAL(10,8),
    origin_lng DECIMAL(11,8),
    
    -- Destination
    destination TEXT NOT NULL,
    destination_lat DECIMAL(10,8),
    destination_lng DECIMAL(11,8),
    
    -- Receiver info
    receiver_name TEXT NOT NULL,
    receiver_email TEXT,
    receiver_phone TEXT,
    
    -- Package details
    weight DECIMAL(10,2),
    dimensions JSONB, -- { length, width, height }
    description TEXT,
    declared_value DECIMAL(10,2),
    special_instructions TEXT,
    
    -- Service & Package Info
    service_type TEXT DEFAULT 'standard' CHECK (service_type IN ('express', 'priority', 'standard', 'economy', 'van', 'truck', 'motorcycle', 'car', '5 tons', '10 tons', '15 tons')),
    package_type TEXT DEFAULT 'parcel' CHECK (package_type IN ('envelope', 'box', 'parcel', 'pallet', 'heavy_load', 'frozen foods', 'pharmaceuticals', 'general cargo')),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned')),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    
    -- Dates
    estimated_delivery TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Cancellation
    cancellation_reason TEXT,
    
    -- PRICING
    shipping_fee DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_sender ON shipments(sender_id);
CREATE INDEX IF NOT EXISTS idx_shipments_driver ON shipments(driver_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_created ON shipments(created_at DESC);

-- =============================================
-- TRACKING EVENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS tracking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    location TEXT,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_shipment ON tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tracking_created ON tracking_events(created_at DESC);

-- =============================================
-- PAYMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_shipment ON payments(shipment_id);

-- =============================================
-- SHIPMENT DOCUMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS shipment_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT, -- 'invoice', 'label', 'receipt', etc.
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DRIVER ROUTES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS driver_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    shipment_ids UUID[] DEFAULT '{}',
    waypoints JSONB, -- Array of { lat, lng, address, order }
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SUPPORT TICKETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'shipping', 'billing', 'technical', 'complaint')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES profiles(id),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

-- =============================================
-- TICKET REPLIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS ticket_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    message TEXT NOT NULL,
    is_staff BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replies_ticket ON ticket_replies(ticket_id);

-- =============================================
-- FAQS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    order_index INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    -- Remove duplicates if any exist
    DELETE FROM faqs a USING faqs b WHERE a.id < b.id AND a.question = b.question;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'faqs_question_key') THEN
        ALTER TABLE faqs ADD CONSTRAINT faqs_question_key UNIQUE (question);
    END IF;
END $$;

-- =============================================
-- CONTACT SUBMISSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- =============================================
-- CHAT SESSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- =============================================
-- CHAT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    message TEXT NOT NULL,
    is_from_user BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);

-- =============================================
-- PRICING CONFIGURATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS pricing_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type TEXT UNIQUE NOT NULL CHECK (service_type IN ('express', 'priority', 'standard', 'economy')),
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_per_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_per_km DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_configs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
    
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Addresses policies
DROP POLICY IF EXISTS "Users can manage own addresses" ON addresses;
CREATE POLICY "Users can manage own addresses" ON addresses
    FOR ALL USING (auth.uid() = user_id);

-- Shipments policies
DROP POLICY IF EXISTS "Users can view own shipments" ON shipments;
CREATE POLICY "Users can view own shipments" ON shipments
    FOR SELECT USING (auth.uid() = sender_id);
    
DROP POLICY IF EXISTS "Users can create shipments" ON shipments;
CREATE POLICY "Users can create shipments" ON shipments
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Tracking events policies
DROP POLICY IF EXISTS "Anyone can view tracking events" ON tracking_events;
CREATE POLICY "Anyone can view tracking events" ON tracking_events
    FOR SELECT USING (true);

-- Support tickets policies
DROP POLICY IF EXISTS "Users can manage own tickets" ON support_tickets;
CREATE POLICY "Users can manage own tickets" ON support_tickets
    FOR ALL USING (auth.uid() = user_id);

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);
    
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Payments policies
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM shipments 
            WHERE shipments.id = payments.shipment_id 
            AND shipments.sender_id = auth.uid()
        )
    );

-- Pricing configs policies
DROP POLICY IF EXISTS "Anyone can view pricing configs" ON pricing_configs;
CREATE POLICY "Anyone can view pricing configs" ON pricing_configs
    FOR SELECT USING (true);

-- =============================================
-- SEED DATA (Optional - for testing)
-- =============================================

-- Insert sample FAQs
INSERT INTO faqs (question, answer, category, order_index) VALUES
('How do I track my shipment?', 'You can track your shipment by entering your tracking number on our tracking page or in your dashboard.', 'shipping', 1),
('What are your delivery times?', 'Express: 1 day, Priority: 2-3 days, Standard: 5-7 days, Economy: 7-10 days.', 'shipping', 2),
('How do I create an account?', 'Click the Sign Up button and fill in your details. You will receive a confirmation email.', 'general', 3),
('What payment methods do you accept?', 'We accept all major credit cards, PayPal, and bank transfers.', 'billing', 4),
('How do I cancel a shipment?', 'You can cancel a shipment from your dashboard if it has not been picked up yet.', 'shipping', 5)
ON CONFLICT (question) DO NOTHING;

-- Insert default pricing configs
INSERT INTO pricing_configs (service_type, base_price, price_per_kg, price_per_km) VALUES
('standard', 1000.00, 50.00, 10.00),
('express', 2500.00, 100.00, 20.00),
('priority', 1800.00, 75.00, 15.00),
('economy', 500.00, 30.00, 5.00)
ON CONFLICT (service_type) DO NOTHING;

-- =============================================
-- DONE! Your database is ready.
-- =============================================
