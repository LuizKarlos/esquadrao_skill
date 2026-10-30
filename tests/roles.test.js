import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROLES,
  LEGACY_ALIASES,
  getRole,
  listRoles,
  checkCommandExecution,
  checkFileWrite,
  checkOutputWrite,
  mediaProducer,
  codeReviewer,
  softwareArchitect,
  productManager,
} from '../src/roles/index.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const binPath = join(repoRoot, 'bin', 'cli.js');

test('Roles: All 12 Canonical Industry Roles Registered', () => {
  const roles = listRoles();
  assert.equal(roles.length, 12);

  const expectedIds = [
    'product-manager',
    'system-analyst',
    'software-architect',
    'tech-lead',
    'security-engineer',
    'software-engineer',
    'code-reviewer',
    'sre-engineer',
    'qa-engineer',
    'technical-writer',
    'engineering-manager',
    'media-producer',
  ];

  for (const id of expectedIds) {
    const r = getRole(id);
    assert.ok(r, `Role ${id} exists in registry`);
    assert.equal(r.definition.id, id);
    assert.ok(r.definition.title.length > 0);
    assert.ok(r.definition.description.length > 0);
    assert.ok(Array.isArray(r.definition.requiredCapabilities));
    assert.equal(typeof r.buildPrompt, 'function');
    assert.equal(typeof r.validateContract, 'function');
  }
});

test('Roles: Legacy Aliases Map to Standard Industry Names', () => {
  const aliasMappings = {
    mission_compiler: 'product-manager',
    cartographer: 'system-analyst',
    chief_architect: 'software-architect',
    architecture_adjudicator: 'tech-lead',
    spec_critic: 'security-engineer',
    implementer: 'software-engineer',
    reviewer: 'code-reviewer',
    failure_diagnostician: 'sre-engineer',
    critical_acceptance: 'qa-engineer',
    documentation: 'technical-writer',
    next_mission_generator: 'engineering-manager',
    studio_director: 'media-producer',
  };

  for (const [legacy, industry] of Object.entries(aliasMappings)) {
    const role = getRole(legacy);
    assert.ok(role, `Legacy alias '${legacy}' resolves to a role`);
    assert.equal(role.definition.id, industry, `Legacy '${legacy}' resolves to '${industry}'`);
  }
});

test('Roles: Structural Authority Matrix and Permission Enforcement', () => {
  // Read-only roles must throw on write
  assert.throws(() => checkFileWrite('system-analyst', 'src/app.js'), /Structural violation/);
  assert.throws(() => checkFileWrite('security-engineer', 'src/app.js'), /Structural violation/);
  assert.throws(() => checkFileWrite('code-reviewer', 'src/app.js'), /Structural violation/);

  // Read-write roles succeed
  assert.doesNotThrow(() => checkFileWrite('software-engineer', 'src/app.js'));
  assert.doesNotThrow(() => checkFileWrite('product-manager', 'docs/requirements.md'));

  // Forbidden git commands throw across all roles
  assert.throws(() => checkCommandExecution('software-engineer', 'git push origin main'), /Structural violation/);
  assert.throws(() => checkCommandExecution('software-engineer', 'git push origin --force'), /Structural violation/);
  assert.throws(() => checkCommandExecution('software-engineer', 'git reset --hard HEAD~1'), /Structural violation/);
  assert.throws(() => checkCommandExecution('software-engineer', 'rm -rf /'), /Structural violation/);

  // Mutating commands on read-only roles throw
  assert.throws(() => checkCommandExecution('code-reviewer', 'npm run build'), /strictly read-only/);

  // Safe read commands on read-only roles pass
  assert.doesNotThrow(() => checkCommandExecution('code-reviewer', 'git diff main...feature'));
  assert.doesNotThrow(() => checkCommandExecution('system-analyst', 'git status'));
});

test('Roles: Per-Role Allowed Outputs Enforcement', () => {
  // Unknown role rejection
  assert.throws(() => checkOutputWrite('nonexistent-role', 'docs/readme.txt'), /Unknown role/);

  // Wildcard allowed for software-engineer
  assert.doesNotThrow(() => checkOutputWrite('software-engineer', 'src/arbitrary.js'));
  assert.doesNotThrow(() => checkOutputWrite('software-engineer', 'package.json'));

  // Scoped prefix checks: software-architect (docs/, reports/, schemas/)
  assert.doesNotThrow(() => checkOutputWrite('software-architect', 'docs/spec.md'));
  assert.doesNotThrow(() => checkOutputWrite('software-architect', 'reports/analysis.json'));
  assert.doesNotThrow(() => checkOutputWrite('software-architect', 'schemas/contract.json'));
  assert.throws(() => checkOutputWrite('software-architect', 'src/code.js'), /violates allowed output prefixes/);
  assert.throws(() => checkOutputWrite('software-architect', 'package.json'), /violates allowed output prefixes/);

  // Technical writer specific file paths and prefixes (docs/, README.md, CHANGELOG.md, reports/)
  assert.doesNotThrow(() => checkOutputWrite('technical-writer', 'docs/user-guide.md'));
  assert.doesNotThrow(() => checkOutputWrite('technical-writer', 'README.md'));
  assert.doesNotThrow(() => checkOutputWrite('technical-writer', 'CHANGELOG.md'));
  assert.throws(() => checkOutputWrite('technical-writer', 'src/index.js'), /violates allowed output prefixes/);

  // Media producer allowed prefixes (media/, reports/, packages/)
  assert.doesNotThrow(() => checkOutputWrite('media-producer', 'media/output.mp4'));
  assert.doesNotThrow(() => checkOutputWrite('media-producer', 'reports/qa.json'));
  assert.throws(() => checkOutputWrite('media-producer', 'src/app.js'), /violates allowed output prefixes/);

  // Legacy alias mapping works with checkOutputWrite
  assert.doesNotThrow(() => checkOutputWrite('chief_architect', 'docs/spec.md'));
  assert.throws(() => checkOutputWrite('chief_architect', 'src/code.js'), /violates allowed output prefixes/);

  // checkFileWrite wiring: read/write roles must respect allowed outputs
  assert.throws(() => checkFileWrite('software-architect', 'src/app.js'), /violates allowed output prefixes/);
  assert.doesNotThrow(() => checkFileWrite('software-architect', 'docs/architecture.md'));
  assert.throws(() => checkFileWrite('media-producer', 'bin/cli.js'), /violates allowed output prefixes/);
  assert.doesNotThrow(() => checkFileWrite('media-producer', 'media/rendered.mp4'));

  // Read-only roles still blocked with read-only violation even on their declared prefix
  assert.throws(() => checkFileWrite('system-analyst', 'reports/analysis.json'), /strictly read-only/);
});

test('Roles: Anti-Self-Review Guard in Code Reviewer', () => {
  assert.throws(
    () => codeReviewer.buildPrompt({ diff: '+code', implementerId: 'agent-1', reviewerId: 'agent-1' }),
    /Anti-self-review violation/
  );
  assert.doesNotThrow(
    () => codeReviewer.buildPrompt({ diff: '+code', implementerId: 'agent-1', reviewerId: 'agent-2' })
  );
});

test('Roles: Software Architect Contract Validation', () => {
  const validContract = {
    architecture: 'Modular service architecture',
    decisions: [{ decision: 'ESM', rationale: 'Native Node standard' }],
    allowed_changes: ['src/service.js'],
    invariants: ['Zero runtime dependencies'],
    rollback_conditions: ['Test suite failure'],
    implementation_sequence: ['Step 1'],
  };
  assert.equal(softwareArchitect.validateContract(validContract), true);

  assert.throws(() => softwareArchitect.validateContract({ architecture: 'Test' }), /"allowed_changes"/);
  assert.throws(
    () => softwareArchitect.validateContract({ architecture: 'Test', allowed_changes: [], invariants: [] }),
    /"invariants"/
  );
});

test('Roles: Media Producer Short-Form Video Parameter Validation', () => {
  // 1. Cut interval bounds
  assert.equal(mediaProducer.validateCutInterval({ in_ms: 0, out_ms: 1500 }), true);
  assert.throws(() => mediaProducer.validateCutInterval({ in_ms: 0, out_ms: 50 }), /too short/);
  assert.throws(() => mediaProducer.validateCutInterval({ in_ms: 1000, out_ms: 500 }), /Invalid interval/);

  // 2. Text clip NFC normalization and HTML rejection
  assert.equal(
    mediaProducer.validateTextClip({
      kind: 'text',
      text: 'Texto em português com acentuação NFC',
      duration_ms: 3000,
      timeline_start_ms: 0,
    }),
    true
  );
  assert.throws(
    () => mediaProducer.validateTextClip({ kind: 'text', text: '<b>HTML não permitido</b>', duration_ms: 3000, timeline_start_ms: 0 }),
    /HTML markup/
  );
  assert.throws(
    () => mediaProducer.validateTextClip({ kind: 'text', text: '', duration_ms: 3000, timeline_start_ms: 0 }),
    /between 1 and 200/
  );

  // 3. Audio gain bounds (-60 to +12 dB)
  assert.equal(mediaProducer.validateAudioTrack({ kind: 'source', gain_db: 0 }), true);
  assert.equal(mediaProducer.validateAudioTrack({ kind: 'source', gain_db: -12 }), true);
  assert.throws(() => mediaProducer.validateAudioTrack({ kind: 'source', gain_db: 20 }), /gain_db must be between/);

  // 4. Valid edit_only EditPlan
  const validEditOnly = {
    schema_version: 1,
    mode: 'edit_only',
    clips: [
      { kind: 'video', clip_id: 'c1', asset_id: 'a1', in_ms: 0, out_ms: 1000, timeline_start_ms: 0, speed: 1 },
      { kind: 'video', clip_id: 'c2', asset_id: 'a1', in_ms: 1000, out_ms: 2500, timeline_start_ms: 1000, speed: 1 },
    ],
    audio_tracks: [
      { kind: 'source', clip_id: 'c1', gain_db: 0 },
      { kind: 'source', clip_id: 'c2', gain_db: -3 },
    ],
    output: {
      width: 1080,
      height: 1920,
      fps_num: 30,
      fps_den: 1,
      video_codec: 'h264',
      audio_codec: 'aac',
    },
  };
  assert.equal(mediaProducer.validateEditPlan(validEditOnly), true);

  // 5. Non-contiguous clips rejected
  const nonContiguous = JSON.parse(JSON.stringify(validEditOnly));
  nonContiguous.clips[1].timeline_start_ms = 1200; // gap of 200ms
  assert.throws(() => mediaProducer.validateEditPlan(nonContiguous), /Clips must be contiguous/);
});

test('Roles: CLI Commands execution', () => {
  // 1. universal-skill role list --json
  const listRaw = execFileSync(process.execPath, [binPath, 'role', 'list', '--json'], { encoding: 'utf8' });
  const listData = JSON.parse(listRaw);
  assert.equal(Array.isArray(listData), true);
  assert.equal(listData.length, 12);

  // 2. universal-skill role info software-architect --json
  const infoRaw = execFileSync(process.execPath, [binPath, 'role', 'info', 'software-architect', '--json'], { encoding: 'utf8' });
  const infoData = JSON.parse(infoRaw);
  assert.equal(infoData.id, 'software-architect');
  assert.equal(infoData.formerName, 'chief_architect');

  // 3. universal-skill role prompt media-producer "Vertical short" --json
  const promptRaw = execFileSync(
    process.execPath,
    [binPath, 'role', 'prompt', 'media-producer', 'Vertical short', '--json'],
    { encoding: 'utf8' }
  );
  const promptData = JSON.parse(promptRaw);
  assert.equal(promptData.role, 'media-producer');
  assert.ok(promptData.prompt.includes('Media Producer'));

  // 4. universal-skill role matrix --json
  const matrixRaw = execFileSync(process.execPath, [binPath, 'role', 'matrix', '--json'], { encoding: 'utf8' });
  const matrixData = JSON.parse(matrixRaw);
  assert.ok(matrixData.readOnlyRoles.includes('system-analyst'));
  assert.ok(matrixData.readOnlyRoles.includes('security-engineer'));
  assert.ok(matrixData.readOnlyRoles.includes('code-reviewer'));
  assert.equal(matrixData.roles.length, 12);
});
