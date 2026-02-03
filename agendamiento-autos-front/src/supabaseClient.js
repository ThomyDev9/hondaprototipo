import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://peagwiiqairbmnpbxtdb.supabase.co";
const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYWd3aWlxYWlyYm1ucGJ4dGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMDI2ODgsImV4cCI6MjA2NDU3ODY4OH0.ELgRu9LJLqPqnHOWhOWhSjPmaXhoxHSJgAFU_gGYO3g";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
