---
name: skill-media-producer
version: "1.0.0"
description: "Author and validate short-form video edit plans, timeline cuts, audio gain parameters, NFC text normalization, and media QA contracts."
allowed-tools: ["terminal"]
---

# Media Producer

Author and validate deterministic short-form video specifications, cut intervals, audio leveling, and media QA rules.

## When to Use

- Generating structured EditPlan contracts for short-form video pipelines (`edit_only`, `dark`, `podcast_clip`).
- Validating timeline clip contiguity, boundary intervals (minimum 100ms), and audio stream gains (-60 dB to +12 dB).
- Enforcing NFC text normalization (1–200 characters, zero HTML markup) for visual caption and text overlays.
- Setting up automated media QA verification for black frames, audio sync, and duration compliance.

## NOT for

- Merkle cryptographic chain validation (`skill-audit`).
- Multi-agent swarm leasing locks (`skill-orchestrate`).
- Code syntax AST slicing (`skill-context`).

## Workflow & CLI

Execute via `universal-skill role`:

```bash
# 1. View media producer parameters and schema constraints
universal-skill role info media-producer

# 2. Generate edit plan authoring prompt
universal-skill role prompt media-producer "Author 2-cut vertical video edit plan for 1080x1920 @ 30fps"
```

## Specifications & Parameters

### Modes
- `edit_only`: Exactly 2 contiguous video clips from source footage; matching source audio tracks.
- `dark`: Visual text overlays (`TextClip`) with no spoken TTS; 1–200 NFC characters, no HTML.
- `podcast_clip`: Selective cuts from recorded live/podcast footage.

### Output Standard
- Resolution: Vertical `1080x1920` or Horizontal `1920x1080`.
- Frame Rate: `30/1` FPS.
- Encoding: `h264` (video) and `aac` (audio).
- Cut Intervals: Integer bounds in milliseconds, each clip >= 100ms.
- Audio Gain: Bound between `-60` and `+12` dB.
