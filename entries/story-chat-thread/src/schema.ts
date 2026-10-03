import {z} from 'zod';

export const Props = z.object({
  /** Name shown at the top of the chat (the other person, or a group). */
  contact: z.string().min(1).max(30),
  /** Small line under the contact, e.g. "online" or "Rome, 44 BC". */
  status: z.string().max(30).default('online'),
  /** 2–16 messages. "me" bubbles are on the right. */
  messages: z.array(z.object({from: z.enum(['me', 'them']), text: z.string().min(1).max(140), time: z.string().max(8).default('')})).min(2).max(16),
  theme: z.enum(['light', 'dark']).default('dark'),
  /** Fictional dialogues about real people must be labelled; shown as a small banner. */
  label: z.string().max(40).default(''),
});

export type Props = z.infer<typeof Props>;
