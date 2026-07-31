import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";


const SUPABASE_URL =
    "https://vpvwvtpbrkrrlezwkpup.supabase.co";


const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnd2dHBicmtycmxlendrcHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjM0ODMsImV4cCI6MjEwMDg5OTQ4M30.4Sq3G2P6LYH2nXgQxTdDG8tP39F0Mbp34m7AfaaqrcE";


export const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
