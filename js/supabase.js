import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_SUPABASE_PUBLISHABLE_KEY";

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);
