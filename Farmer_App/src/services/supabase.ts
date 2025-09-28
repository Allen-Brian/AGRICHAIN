import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gmzuozfznzxztcwgdwlq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtenVvemZ6bnp4enRjd2dkd2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODEyOTQ1OSwiZXhwIjoyMDczNzA1NDU5fQ.O8Hppy5gqqwy4k6GvWHx6h26lBGJPtn2qfEf9ymoyr4';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
