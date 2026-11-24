import { describe, expect, test } from 'bun:test';
import { ArchitectTurnRequestSchema } from './architect-http';

describe('Architect HTTP turn request boundary validation', () => {
  test('accepts valid prompt with image & file attachments and MCQ answers', () => {
    const ok = ArchitectTurnRequestSchema.safeParse({
      prompt: 'Build a YouTube tracker from this screenshot',
      attachments: [
        { name: 'mockup.png', mimeType: 'image/png', data: 'iVBORw0KGgo=', kind: 'image' },
        { name: 'sample.json', mimeType: 'application/json', data: '{"views":1200}', kind: 'file' },
      ],
      answers: { q1: ['tracker'] },
    });
    expect(ok.success).toBe(true);
  });

  test('rejects empty prompt or more than 6 attachments', () => {
    expect(ArchitectTurnRequestSchema.safeParse({ prompt: '' }).success).toBe(false);
    const tooMany = Array.from({ length: 7 }, (_, i) => ({
      name: `f${i}.txt`,
      mimeType: 'text/plain',
      data: 'x',
      kind: 'file' as const,
    }));
    expect(ArchitectTurnRequestSchema.safeParse({ prompt: 'hi', attachments: tooMany }).success).toBe(false);
  });
});
