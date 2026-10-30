import { checkHealth } from '../client.js';
import { getEndpoint } from '../config.js';

// ponytail: unary health ping; upgrade to full telemetry snapshot when dashboard ready
export async function run({ flags = {} } = {}) {
  const endpoint = flags.endpoint || getEndpoint();
  try {
    new URL(endpoint);
  } catch (err) {
    throw new Error(`Invalid URL: ${err.message}`);
  }

  const health = await checkHealth({ endpoint, token: flags.token });
  const out = { endpoint, status: health?.status || 'ok', health };
  if (flags.json) {
    console.log(JSON.stringify(out));
  } else {
    console.log(`Endpoint: ${endpoint}\nStatus: ${out.status}`);
  }
  return out;
}

export default run;
