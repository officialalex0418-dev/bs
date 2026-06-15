import Notification from '../models/Notification.js';
import { realtime } from '../sockets/index.js';

/** Create DB notification + push over socket. Fire-and-forget safe. */
export async function notify({ recipient, company, type, title, message, link }) {
  try {
    const n = await Notification.create({ recipient, company, type, title, message, link });
    realtime.notify(recipient.toString(), n);
    return n;
  } catch (e) {
    console.error('notification failed:', e.message);
    return null;
  }
}

export async function notifyMany(recipients, payload) {
  return Promise.all(recipients.map((r) => notify({ ...payload, recipient: r })));
}
