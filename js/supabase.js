import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "https://cezzhfynfaegfrhuvcmy.supabase.co";
const supabaseKey = "sb_publishable_sqGNx1vWkp-olTYypoQ-uA_RsvRMg1K";

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);
