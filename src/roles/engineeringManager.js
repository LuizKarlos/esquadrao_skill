// Engineering Delivery Manager / Agile Coach (formerly next_mission_generator)
// Derives follow-up engineering milestones, roadmap planning, and task backlogs from actual execution evidence.

export const definition = {
  id: 'engineering-manager',
  title: 'Engineering Manager',
  formerName: 'next_mission_generator',
  category: 'management',
  description: 'Synthesizes completed project evidence into follow-up milestones, roadmap iterations, and next sprint tasks.',
  requiredCapabilities: ['chat'],
  readOnly: false,
  allowedOutputPrefixes: ['docs/', 'reports/', 'NEXT_MISSION.md'],
};

export function buildPrompt(params = {}) {
  const { completedTask = '', verdict = '', remainingDebt = [] } = params;
  return `You are acting as an Engineering Delivery Manager and Agile Lead.
Derive the next actionable milestone and sprint backlog based on verified execution evidence.

Completed Task:
${completedTask}

Acceptance Verdict:
${verdict}

Remaining Technical Debt / Future Scope:
${remainingDebt.map((d) => `- ${d}`).join('\n') || '- None noted'}

Output Requirements:
Return a structured JSON object with:
{
  "next_milestone": "Concise title of the subsequent milestone",
  "priority": "P0 | P1 | P2",
  "objectives": ["concrete objective 1", "concrete objective 2"],
  "tasks": [
    {
      "id": "TASK-01",
      "title": "Task title",
      "assigned_role": "role identifier",
      "description": "Short description of expected output"
    }
  ],
  "invariants_to_preserve": ["system guarantees that remain protected"]
}`;
}

export function validateContract(data) {
  if (!data || typeof data !== 'object') throw new Error('Contract must be an object');
  if (!data.next_milestone || typeof data.next_milestone !== 'string') throw new Error('Missing "next_milestone"');
  if (!Array.isArray(data.objectives)) throw new Error('"objectives" must be an array');
  if (!Array.isArray(data.tasks) || data.tasks.length === 0) throw new Error('"tasks" must be a non-empty array');
  return true;
}
