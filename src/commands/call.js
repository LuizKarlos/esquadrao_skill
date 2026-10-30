import { callTool } from '../client.js';

// ponytail: single tool caller; upgrade to multi-step agent pipeline when needed
export async function run({ positionals = [], flags = {} } = {}) {
  const [name, rawArgs] = positionals;
  if (!name) throw new Error('Tool name required. Usage: universal-skill call <tool> [args-json]');
  let args = {};
  if (rawArgs) {
    try {
      args = JSON.parse(rawArgs);
    } catch (e) {
      throw new Error(`Invalid JSON arguments: ${e.message}`);
    }
  }
  const result = await callTool(name, args, { endpoint: flags.endpoint, token: flags.token });
  if (flags.json) {
    console.log(JSON.stringify(result));
  } else {
    const formatted = typeof result === 'object' ? JSON.stringify(result, null, 2) : result;
    console.log(formatted);
  }
  return result;
}

export default run;
