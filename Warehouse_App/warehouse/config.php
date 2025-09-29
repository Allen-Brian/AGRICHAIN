<?php
// ==================================================================
// Supabase Configuration
// ==================================================================
define('DB_HOST', 'db.gmzuozfznzxztcwgdwlq.supabase.co');
define('DB_NAME', 'postgres');
define('DB_USER', 'postgres');
define('DB_PASS', 'Nh4iRQD0suZMMSYq');
define('DB_PORT', '5432');

// ==================================================================
// Application Settings
// ==================================================================
define('APP_NAME', 'AgriChain Warehouse Management');
define('APP_VERSION', '1.0.0');

// Toggle for development (true) vs production (false)
define('DEBUG_MODE', true);

// ==================================================================
// Error Reporting
// ==================================================================
if (DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', __DIR__ . '/app_errors.log');
}

// ==================================================================
// Timezone
// ==================================================================
date_default_timezone_set('UTC');

// ==================================================================
// Security Key
// ==================================================================
// Replace with a secure random string (32+ characters)
// Example: php -r "echo bin2hex(random_bytes(32));"
define('APP_KEY', 'd3f0e61f8b52c4f4a1b8e9fcae5c6ad7d8c07e4c5a8234f9f1c2d6a98e4b3f7a');

// ==================================================================
// Production Recommendations
// ==================================================================
// 1. Move this file outside the web root
// 2. Use environment variables instead of constants
// 3. Implement proper error logging
// 4. Add rate limiting
// 5. Implement JWT authentication