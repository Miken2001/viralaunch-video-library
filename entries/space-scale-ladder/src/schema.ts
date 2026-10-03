import {z} from 'zod';

export const Props = z.object({
  title: z.string().min(1).max(60),
  /** 3–8 objects in the order shown (usually small → large). size is a diameter in `unit`. */
  objects: z.array(z.object({
    name: z.string().min(1).max(28),
    size: z.number().positive(),
    /** Display text for the size, e.g. "12,742 km". */
    sizeLabel: z.string().max(28),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    /** Draw rings (Saturn-like) around the body. */
    rings: z.boolean().default(false),
  })).min(3).max(8),
  showCaptions: z.boolean().default(true),
});

export type Props = z.infer<typeof Props>;
