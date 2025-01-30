import {env} from '@/env';
import {configure} from '@trigger.dev/sdk/v3';

configure({
  secretKey: env.TRIGGER_SECRET_KEY,
  baseURL: env.TRIGGER_API_URL,
});
