// Loaded first (before AppModule) so .env values are present when @Cron
// decorators are evaluated at import time.
import { config } from 'dotenv';
config();
