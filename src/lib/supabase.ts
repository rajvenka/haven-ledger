import { createClient } from '@supabase/supabase-js';

// Public Supabase project URL + anon key. Safe to expose client-side —
// all access control is enforced server-side via Postgres Row Level Security.
const supabaseUrl = 'https://kvyegcurnwntykqmwrzs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eWVnY3VybndudHlrcW13cnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDY2OTUsImV4cCI6MjA5OTE4MjY5NX0.b1m0UUFG9PCkVjtpYJ0GV4pzgXV28icGkbzBrXWtItE';

export const supabase = createClient(supabaseUrl, supabaseKey);
