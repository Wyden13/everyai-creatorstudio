/**
 * Publisher Agent: generates strict metadata (title, description, tags, thumbnail prompt),
 * honors explicit PublishApprovalMode ('gate' | 'scheduled' | 'auto'), and publishes to
 * YouTube Data API v3 (16:9 + Shorts) and Ayrshare / Upload-Post (TikTok + Reels).
 */
import { z } from 'zod';
import { validateModelForNode, type Storyboard } from '../contracts';
import { callLlmJson } from '../providers';

export type PublishApprovalMode = 'gate' | 'scheduled' | 'auto';
export type PublishState = 'Drafting' | 'NeedsApproval' | 'Scheduled' | 'Publishing' | 'Published' | 'Failed';
export type PublishEvent = 'metadata_ready' | 'approve' | 'schedule' | 'due' | 'published' | 'fail' | 'retry';

export const PublishMetadataSchema = z.object({
  title: z.string().min(1).max(70),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1).max(15),
  thumbnail_prompt: z.string().min(1),
});
export type PublishMetadata = z.infer<typeof PublishMetadataSchema>;

/**
 * Every legal Publish lifecycle transition is a row here; add new behavior as a row,
 * never as ad-hoc booleans.
 */
const PUBLISH_TRANSITIONS: Partial<Record<`${PublishState}:${PublishEvent}`, PublishState>> = {
  'Drafting:approve': 'Publishing',
  'NeedsApproval:approve': 'Publishing',
  'NeedsApproval:schedule': 'Scheduled',
  'Scheduled:due': 'Publishing',
  'Scheduled:approve': 'Publishing',
  'Publishing:published': 'Published',
  'Publishing:fail': 'Failed',
  'Failed:retry': 'Publishing',
};

export function transitionPublish(
  state: PublishState,
  event: PublishEvent,
  mode: PublishApprovalMode = 'gate',
): { ok: true; next: PublishState } | { ok: false; reason: string } {
  if (state === 'Drafting' && event === 'metadata_ready') {
    const next: PublishState = mode === 'auto' ? 'Publishing' : mode === 'scheduled' ? 'Scheduled' : 'NeedsApproval';
    return { ok: true, next };
  }
  const next = PUBLISH_TRANSITIONS[`${state}:${event}`];
  if (!next) {
    return { ok: false, reason: `Illegal publish transition: ${state} × ${event}` };
  }
  return { ok: true, next };
}

export async function generatePublishMetadata(opts: {
  storyboard: Storyboard;
  providerId: string;
  modelId: string;
  apiKey: string;
}): Promise<PublishMetadata> {
  const raw = await callLlmJson({
    nodeKind: 'publisher',
    providerId: opts.providerId,
    modelId: opts.modelId,
    apiKey: opts.apiKey,
    systemPrompt:
      'You are a YouTube & short-form content strategist. Return ONLY valid JSON with keys: title (<=60 chars), description, tags (array of 5-8 concise tags), thumbnail_prompt.',
    userPrompt: JSON.stringify({
      title: opts.storyboard.title,
      hook: opts.storyboard.hook,
      scenes: opts.storyboard.scenes.map((s) => s.narration),
    }),
  });
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = PublishMetadataSchema.safeParse(JSON.parse(cleaned));
  if (!parsed.success) {
    throw new Error(`Publish metadata violated schema: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function publishToYouTube(opts: {
  oauthAccessToken: string;
  metadata: PublishMetadata;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  scheduledForIso?: string;
}): Promise<{ uploadSessionUrl: string }> {
  const check = validateModelForNode('publisher', 'youtube', 'youtube-v3');
  if (!check.ok) throw new Error(check.reason);
  if (!opts.oauthAccessToken) throw new Error('Missing YouTube OAuth access token');

  const res = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.oauthAccessToken}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        snippet: {
          title: opts.metadata.title,
          description: opts.metadata.description,
          tags: opts.metadata.tags,
          categoryId: '28',
        },
        status: {
          privacyStatus: opts.scheduledForIso ? 'private' : (opts.privacyStatus ?? 'public'),
          publishAt: opts.scheduledForIso,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`YouTube Data API error ${res.status}: ${await res.text()}`);
  const uploadSessionUrl = res.headers.get('location');
  if (!uploadSessionUrl) throw new Error('YouTube API did not return resumable upload Location header');
  return { uploadSessionUrl };
}

export async function publishToAyrshare(opts: {
  apiKey: string;
  mediaUrl: string;
  metadata: PublishMetadata;
  platforms: ('tiktok' | 'instagram')[];
  scheduledForIso?: string;
}): Promise<{ id: string }> {
  const check = validateModelForNode('publisher', 'ayrshare', 'ayrshare-social');
  if (!check.ok) throw new Error(check.reason);
  if (!opts.apiKey) throw new Error('Missing Ayrshare API key');

  const res = await fetch('https://app.ayrshare.com/api/post', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      post: `${opts.metadata.title}\n\n${opts.metadata.tags.map((t) => `#${t.replace(/\s+/g, '')}`).join(' ')}`,
      platforms: opts.platforms,
      mediaUrls: [opts.mediaUrl],
      scheduleDate: opts.scheduledForIso,
    }),
  });
  if (!res.ok) throw new Error(`Ayrshare API error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { id?: string };
  return { id: data.id ?? 'queued' };
}
