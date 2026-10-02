const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  CHROME_DEBUG_PORT: parseInt(process.env.CHROME_DEBUG_PORT || '9222', 10),
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
  SUNO_MODEL_VERSION: process.env.SUNO_MODEL_VERSION || 'v4',
  SUNO_URL: 'https://suno.com/create'
};
