// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plpkewtyfpdxswvswapw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscGtld3R5ZnBkeHN3dnN3YXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMTA3MDMsImV4cCI6MjA2MzU4NjcwM30.OSLy3L6juM5LyR9G9yyZp3_HGGnufd2mNnJtIfsNgTk';

export const supabase = createClient(supabaseUrl, supabaseKey);
