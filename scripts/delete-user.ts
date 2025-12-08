// import { drizzle } from 'drizzle-orm/postgres-js';
// import postgres from 'postgres';
// import * as schema from '../drizzle/schema';
// import { createClient } from '@supabase/supabase-js';

// const client = postgres(process.env.DATABASE_URL || '');
// const db = drizzle(client, { schema });

// const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// const { data, error } = await adminSupabase.auth.admin.deleteUser();

// if (error) {
//   console.error(error);
// }

// console.log(data);
