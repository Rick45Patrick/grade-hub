import { createClient } 
from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";


const supabaseUrl =
"https://vpvwvtpbrkrrlezwkpup.supabase.co";


const supabaseKey =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnd2dHBicmtycmxlendrcHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjM0ODMsImV4cCI6MjEwMDg5OTQ4M30.4Sq3G2P6LYH2nXgQxTdDG8tP39F0Mbp34m7AfaaqrcE";


export const supabase =
createClient(
    supabaseUrl,
    supabaseKey
);
