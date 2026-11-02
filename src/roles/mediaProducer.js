// Media Producer / Creative Director Role
// Portable specification and validation engine for local-first short-form video pipelines.

export const definition = {
  id: 'media-producer',
  title: 'Media Producer',
  formerName: 'studio_director',
  category: 'media',
  description: 'Authors and validates short-form video edit plans, timeline cuts, audio gain parameters, NFC text normalization, and media QA contracts.',
  requiredCapabilities: ['chat'],
  readOnly: false,
  allowedOutputPrefixes: ['media/', 'reports/', 'packages/'],
};

export function normalizeNfc(text = '') {
  return typeof text === 'string' ? text.normalize('NFC') : '';
}

export function validateCutInterval(interval) {
  if (!interval || typeof interval !== 'object') throw new Error('CutInterval must be an object');
  const { in_ms, out_ms } = interval;
  if (!Number.isInteger(in_ms) || !Number.isInteger(out_ms)) {
    throw new Error(`Interval bounds must be integers: [${in_ms}, ${out_ms})`);
  }
  if (in_ms < 0) throw new Error(`in_ms cannot be negative: ${in_ms}`);
  if (out_ms <= in_ms) throw new Error(`Invalid interval: in_ms (${in_ms}) >= out_ms (${out_ms})`);
  if (out_ms - in_ms < 100) throw new Error(`Interval duration too short (< 100ms): ${out_ms - in_ms}ms`);
  return true;
}

export function validateVideoClip(clip) {
  if (!clip || typeof clip !== 'object') throw new Error('VideoClip must be an object');
  if (clip.kind !== 'video') throw new Error('VideoClip.kind must be "video"');
  if (clip.speed !== undefined && clip.speed !== 1) throw new Error('V1 speed must be 1');
  if (clip.timeline_start_ms < 0) throw new Error('timeline_start_ms cannot be negative');
  validateCutInterval({ in_ms: clip.in_ms, out_ms: clip.out_ms });
  return true;
}

export function validateTextClip(clip) {
  if (!clip || typeof clip !== 'object') throw new Error('TextClip must be an object');
  if (clip.kind !== 'text') throw new Error('TextClip.kind must be "text"');
  const norm = normalizeNfc(clip.text);
  if (norm.length < 1 || norm.length > 200) {
    throw new Error(`TextClip text length must be between 1 and 200 NFC characters, got ${norm.length}`);
  }
  if (norm.includes('<') || norm.includes('>')) {
    throw new Error('TextClip cannot contain HTML markup');
  }
  if (!Number.isInteger(clip.duration_ms) || clip.duration_ms < 100 || clip.duration_ms > 600000) {
    throw new Error(`TextClip duration_ms must be between 100 and 600000ms, got ${clip.duration_ms}`);
  }
  if (clip.timeline_start_ms < 0) throw new Error('TextClip timeline_start_ms cannot be negative');
  return true;
}

export function validateAudioTrack(track) {
  if (!track || typeof track !== 'object') throw new Error('AudioTrack must be an object');
  if (track.kind !== 'source') throw new Error('AudioTrack.kind must be "source"');
  if (typeof track.gain_db !== 'number' || track.gain_db < -60 || track.gain_db > 12) {
    throw new Error(`gain_db must be between -60 and +12 dB, got ${track.gain_db}`);
  }
  return true;
}

export function validateEditPlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('EditPlan must be an object');
  if (plan.schema_version !== 1) throw new Error(`Unsupported schema_version: ${plan.schema_version}`);
  if (!['edit_only', 'dark', 'podcast_clip'].includes(plan.mode)) {
    throw new Error(`Unsupported mode: ${plan.mode}`);
  }

  // Clips validation
  if (plan.mode === 'edit_only') {
    if (!Array.isArray(plan.clips) || plan.clips.length !== 2) {
      throw new Error(`V1 edit_only slice requires exactly 2 clips, got ${plan.clips?.length}`);
    }
    let timelinePos = 0;
    for (let i = 0; i < plan.clips.length; i++) {
      const c = plan.clips[i];
      validateVideoClip(c);
      if (c.timeline_start_ms !== timelinePos) {
        throw new Error(`Clips must be contiguous: clip ${i} starts at ${c.timeline_start_ms}, expected ${timelinePos}`);
      }
      timelinePos += c.out_ms - c.in_ms;
    }

    if (!Array.isArray(plan.audio_tracks) || plan.audio_tracks.length !== plan.clips.length) {
      throw new Error('Each video clip must have an accompanying source audio track');
    }
    for (let i = 0; i < plan.audio_tracks.length; i++) {
      const a = plan.audio_tracks[i];
      validateAudioTrack(a);
      if (a.clip_id !== plan.clips[i].clip_id) {
        throw new Error(`Audio track ${i} clip_id mismatch: expected ${plan.clips[i].clip_id}`);
      }
    }
  } else if (plan.mode === 'dark') {
    if (!Array.isArray(plan.clips) || plan.clips.length === 0) {
      throw new Error('Dark mode requires at least one TextClip');
    }
    for (const c of plan.clips) {
      validateTextClip(c);
    }
  } else if (plan.mode === 'podcast_clip') {
    if (!Array.isArray(plan.clips) || plan.clips.length === 0) {
      throw new Error('podcast_clip mode requires at least 1 video clip');
    }
    let timelinePos = 0;
    for (let i = 0; i < plan.clips.length; i++) {
      const c = plan.clips[i];
      validateVideoClip(c);
      if (c.timeline_start_ms !== timelinePos) {
        throw new Error(`Clips must be contiguous: clip ${i} starts at ${c.timeline_start_ms}, expected ${timelinePos}`);
      }
      timelinePos += c.out_ms - c.in_ms;
    }

    if (!Array.isArray(plan.audio_tracks) || plan.audio_tracks.length !== plan.clips.length) {
      throw new Error('Each video clip must have an accompanying source audio track');
    }
    for (let i = 0; i < plan.audio_tracks.length; i++) {
      const a = plan.audio_tracks[i];
      validateAudioTrack(a);
      if (a.clip_id !== plan.clips[i].clip_id) {
        throw new Error(`Audio track ${i} clip_id mismatch: expected ${plan.clips[i].clip_id}`);
      }
    }

    if (plan.captions) {
      if (!Array.isArray(plan.captions)) {
        throw new Error('captions must be an array');
      }
      for (const cap of plan.captions) {
        const norm = normalizeNfc(cap.text);
        if (norm.length < 1 || norm.length > 200) {
          throw new Error(`Caption text length must be between 1 and 200 NFC characters, got ${norm.length}`);
        }
        if (norm.includes('<') || norm.includes('>')) {
          throw new Error('Caption cannot contain HTML markup');
        }
      }
    }
  }

  // Output specification
  const output = plan.output || {};
  const validDimensions =
    (output.width === 1080 && output.height === 1920) ||
    (output.width === 1920 && output.height === 1080);
  if (!validDimensions) {
    throw new Error(`Output dimensions must be 1080x1920 (vertical) or 1920x1080 (horizontal), got ${output.width}x${output.height}`);
  }
  if (output.fps_num !== 30 || output.fps_den !== 1) {
    throw new Error('Output FPS must be 30/1');
  }
  if (output.video_codec !== 'h264' || output.audio_codec !== 'aac') {
    throw new Error('Output codecs must be h264 and aac');
  }

  return true;
}

export const validateContract = validateEditPlan;

export function buildPrompt(params = {}) {
  const { mode = 'edit_only', assets = [] } = params;
  return `You are acting as a Media Producer and Video Pipeline Director.
Generate a valid EditPlan contract for short-form video creation.

Mode: ${mode}
Available Assets:
${assets.map((a) => `- ${a}`).join('\n') || '- None provided'}

Rules:
1. Mode edit_only requires exactly 2 contiguous video clips from source media, each >= 100ms.
2. Mode dark requires TextClips with 1-200 NFC characters and zero HTML.
3. Mode podcast_clip requires >= 1 contiguous video clip(s) with accompanying source audio track(s) and optional captions.
4. Audio gain must stay between -60 dB and +12 dB.
5. Output must be 1080x1920 vertical @ 30fps with h264/aac encoding.`;
}
