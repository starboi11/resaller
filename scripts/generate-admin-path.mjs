// Prints a fresh secret path for the admin app, e.g. /Xq3...  (32 characters,
// 192 random bits). Put it in ADMIN_BASE_PATH in the server .env only; the
// admin panel is then reachable at https://admin.<domain><path>/owner and every
// other admin URL answers 404. Do not commit it, do not paste it into chat.
import { randomBytes } from 'node:crypto';
console.log(`/${randomBytes(24).toString('base64url')}`);
