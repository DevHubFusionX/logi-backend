require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@logipeace.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const ADMIN_FIRST_NAME = 'Admin';
const ADMIN_LAST_NAME = 'User';

async function seedAdmin() {
    console.log('🌱 Seeding admin account...\n');

    try {
        // Create admin user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
            user_metadata: {
                first_name: ADMIN_FIRST_NAME,
                last_name: ADMIN_LAST_NAME
            }
        });

        if (authError) {
            console.error('❌ Error creating admin user:', authError.message);
            process.exit(1);
        }

        console.log('✅ Admin user created in auth.users');

        // Update profile role to admin
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', authData.user.id);

        if (profileError) {
            console.error('❌ Error updating profile role:', profileError.message);
            process.exit(1);
        }

        console.log('✅ Profile role updated to admin\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Admin account created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📧 Email:    ${ADMIN_EMAIL}`);
        console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('⚠️  Please change the password after first login!\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }
}

seedAdmin();
