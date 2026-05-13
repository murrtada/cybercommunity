if (!SUPABASE_URL || SUPABASE_URL.includes('your-project-id')) {
  document.addEventListener('DOMContentLoaded', () => {
    showToast('Config Required',
      'Edit js/supabase-config.js with your Supabase project URL and anon key', 'error');
  });
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
