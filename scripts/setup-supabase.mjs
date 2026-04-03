/**
 * MJS POD — Supabase Setup Script
 * Creates tables, seeds drivers, creates storage buckets, sets permissions.
 * Run: node scripts/setup-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://lmyoqbzmjzgbjpunnfxy.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxteW9xYnptanpnYmpwdW5uZnh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE3OTYxOCwiZXhwIjoyMDkwNzU1NjE4fQ.ffF9gSy3s-81bpgJL7LaYCEA1YE8Kvb2W9Zfj8Qw0h8';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSQL(sql) {
  // Use the Supabase Management API's SQL endpoint via fetch
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

async function createTables() {
  console.log('\n=== Creating Tables ===');

  // We'll use the Supabase client to check if tables exist, and create via storage API workaround
  // Since we can't run DDL via REST, we'll use the pg_net extension or the dashboard SQL editor
  // Instead, let's try creating tables by using the Supabase pg endpoint

  const statements = [
    // Create drivers table
    `CREATE TABLE IF NOT EXISTS drivers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      pin TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    // Create invoices table
    `CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number TEXT NOT NULL,
      customer_name TEXT,
      customer_address TEXT,
      pdf_storage_path TEXT,
      status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'in_progress', 'delivered')),
      created_at TIMESTAMPTZ DEFAULT now(),
      uploaded_by TEXT
    )`,
    // Create routes table
    `CREATE TABLE IF NOT EXISTS routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id UUID REFERENCES drivers(id),
      route_date DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    // Create route_stops table
    `CREATE TABLE IF NOT EXISTS route_stops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
      invoice_id UUID REFERENCES invoices(id),
      stop_order INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
      signature_storage_path TEXT,
      photo_storage_path TEXT,
      pod_pdf_storage_path TEXT,
      google_drive_file_id TEXT,
      completed_at TIMESTAMPTZ,
      gps_lat DECIMAL,
      gps_lng DECIMAL,
      notes TEXT
    )`,
  ];

  // Try using Supabase's built-in SQL execution
  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
    if (error) {
      // exec_sql doesn't exist by default - we'll need another approach
      console.log(`  Note: RPC not available, will use alternative method`);
      return false;
    }
  }
  return true;
}

async function createBuckets() {
  console.log('\n=== Creating Storage Buckets ===');

  const buckets = ['invoices', 'signatures', 'photos', 'pods'];

  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
    });

    if (error) {
      if (error.message?.includes('already exists')) {
        console.log(`  ✓ Bucket '${bucket}' already exists`);
      } else {
        console.log(`  ✗ Bucket '${bucket}': ${error.message}`);
      }
    } else {
      console.log(`  ✓ Bucket '${bucket}' created`);
    }
  }
}

async function seedDrivers() {
  console.log('\n=== Seeding Drivers ===');

  const drivers = [
    { name: 'Erik', pin: '1111' },
    { name: 'Jose', pin: '2222' },
    { name: 'Tommy', pin: '3333' },
    { name: 'David', pin: '4444' },
    { name: 'Ryan', pin: '5555' },
  ];

  // Check if drivers already exist
  const { data: existing } = await supabase.from('drivers').select('name');
  if (existing && existing.length > 0) {
    console.log(`  ✓ Drivers already seeded: ${existing.map(d => d.name).join(', ')}`);
    return;
  }

  const { data, error } = await supabase.from('drivers').insert(drivers).select();
  if (error) {
    console.log(`  ✗ Error seeding drivers: ${error.message}`);
    if (error.message.includes('relation "drivers" does not exist')) {
      console.log(`  → Tables need to be created first. See instructions below.`);
    }
  } else {
    console.log(`  ✓ Seeded ${data.length} drivers: ${data.map(d => d.name).join(', ')}`);
  }
}

async function verifyConnection() {
  console.log('=== Verifying Supabase Connection ===');

  // Test basic connectivity
  const { data, error } = await supabase.from('drivers').select('count');
  if (error && error.message.includes('does not exist')) {
    console.log('  ⚠ Connection works but tables not yet created.');
    return 'needs_tables';
  } else if (error) {
    console.log(`  ✗ Connection error: ${error.message}`);
    return 'error';
  }
  console.log('  ✓ Connected to Supabase');
  return 'ok';
}

async function verifySetup() {
  console.log('\n=== Verifying Full Setup ===');

  // Check drivers
  const { data: drivers, error: dErr } = await supabase.from('drivers').select('*');
  if (dErr) {
    console.log(`  ✗ Drivers table: ${dErr.message}`);
  } else {
    console.log(`  ✓ Drivers table: ${drivers.length} drivers`);
    drivers.forEach(d => console.log(`    - ${d.name} (PIN: ${d.pin})`));
  }

  // Check buckets
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log(`  ✗ Storage: ${bErr.message}`);
  } else {
    const bucketNames = buckets.map(b => b.name);
    const needed = ['invoices', 'signatures', 'photos', 'pods'];
    const missing = needed.filter(n => !bucketNames.includes(n));
    if (missing.length === 0) {
      console.log(`  ✓ All 4 storage buckets exist: ${needed.join(', ')}`);
    } else {
      console.log(`  ⚠ Missing buckets: ${missing.join(', ')}`);
    }
  }

  // Check other tables
  for (const table of ['invoices', 'routes', 'route_stops']) {
    const { error } = await supabase.from(table).select('count');
    if (error) {
      console.log(`  ✗ ${table} table: ${error.message}`);
    } else {
      console.log(`  ✓ ${table} table exists`);
    }
  }
}

async function main() {
  console.log('MJS POD — Supabase Setup\n');

  const status = await verifyConnection();

  if (status === 'needs_tables') {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  Tables need to be created first.                    ║');
    console.log('║  Please run the SQL migration in the Supabase        ║');
    console.log('║  Dashboard → SQL Editor.                             ║');
    console.log('║                                                      ║');
    console.log('║  File: supabase/migrations/001_initial_schema.sql    ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('\nCreating storage buckets (these work without tables)...');
    await createBuckets();
    console.log('\nAfter running the SQL, run this script again to verify.');
    return;
  }

  // Tables exist — seed and create buckets
  await seedDrivers();
  await createBuckets();
  await verifySetup();

  console.log('\n✓ Setup complete! Run `npm run dev` to start the app.\n');
}

main().catch(console.error);
