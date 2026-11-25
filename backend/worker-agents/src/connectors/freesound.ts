/**
 * Freesound Royalty-Free Audio & Music Bed Org Connector.
 */

export interface AudioAssetClip {
  id: number;
  name: string;
  durationSec: number;
  license: string;
  previewMp3Url: string;
}

interface RawFreesoundSearch {
  results?: {
    id: number;
    name?: string;
    duration?: number;
    license?: string;
    previews?: { 'preview-hq-mp3'?: string; 'preview-lq-mp3'?: string };
  }[];
}

export function normalizeFreesoundResults(raw: RawFreesoundSearch): AudioAssetClip[] {
  return (raw.results ?? [])
    .map((r) => {
      const url = r.previews?.['preview-hq-mp3'] ?? r.previews?.['preview-lq-mp3'];
      if (!url || !r.name) return null;
      return {
        id: r.id,
        name: r.name,
        durationSec: Number(r.duration ?? 0),
        license: r.license ?? 'CC',
        previewMp3Url: url,
      };
    })
    .filter((x): x is AudioAssetClip => x !== null);
}

export async function searchFreesoundAudio(opts: {
  apiKey: string;
  query: string;
  maxDurationSec?: number;
  pageSize?: number;
}): Promise<AudioAssetClip[]> {
  if (!opts.apiKey) throw new Error('Missing FREESOUND_API_KEY');
  const filter = opts.maxDurationSec ? `duration:[1 TO ${opts.maxDurationSec}]` : 'duration:[1 TO 180]';
  const params = new URLSearchParams({
    query: opts.query,
    filter,
    fields: 'id,name,duration,license,previews',
    page_size: String(Math.min(15, opts.pageSize ?? 6)),
    token: opts.apiKey,
  });
  const res = await fetch(`https://freesound.org/apiv2/search/text/?${params.toString()}`);
  if (!res.ok) throw new Error(`Freesound API error ${res.status}: ${await res.text()}`);
  return normalizeFreesoundResults((await res.json()) as RawFreesoundSearch);
}
