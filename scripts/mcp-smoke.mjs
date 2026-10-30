import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';

// A real JSON-RPC MCP client; all vault operations go through tools/call.
const child = spawn(process.execPath, ['node_modules/world-building-framework/dist/cli/index.js', 'mcp'], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'inherit'] });
let nextId = 0;
const pending = new Map();
const transcript = [];
createInterface({ input: child.stdout }).on('line', line => {
  const msg = JSON.parse(line);
  if (msg.id !== undefined) {
    const p = pending.get(msg.id);
    if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
  }
});
function request(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve: x => { clearTimeout(timeout); resolve(x); }, reject: e => { clearTimeout(timeout); reject(e); } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
async function call(name, args = {}, allowError = false) {
  const response = await request('tools/call', { name, arguments: args });
  const result = JSON.parse(response.content.find(c => c.type === 'text').text);
  transcript.push({ tool: name, arguments: args, response });
  console.log(JSON.stringify({ tool: name, result }));
  if (response.isError && !allowError) throw new Error(JSON.stringify(result));
  return { result, isError: !!response.isError };
}
const link = e => `[[${e.id}|${e.title}]]`;
async function create(title, type, fields, body) {
  const matches = (await call('search', { query: title })).result;
  if (matches.some(x => x.title === title)) throw new Error(`Already exists: ${title}`);
  const args = { frontmatter: { type, title, tags: ['test'], ...fields }, body };
  await call('validate', args);
  const { result } = await call('create', args);
  if (!result.written) throw new Error('Creation failed');
  return { id: result.id, title };
}
try {
  const initialized = await request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'world-mcp-smoke', version: '1.0.0' } });
  transcript.push({ initialize: initialized });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const tools = await request('tools/list');
  transcript.push({ tools });
  console.log(JSON.stringify({ server: initialized.serverInfo, tools: tools.tools.map(t => t.name) }));
  await call('schema');
  await call('configure');
  await call('list_variants');
  if (process.argv.includes('--inspect')) process.exitCode = 0;
  else {
    const species = await create('Lanternfolk', 'entity', { entityType: 'species' }, 'A test species whose fingertips glow when they recall a promise.');
    const port = await create('Port Lumen', 'entity', { entityType: 'location' }, 'A test harbour built around a dark lighthouse.');
    const guild = await create('Beacon Guild', 'entity', { entityType: 'faction', headquarters: link(port) }, 'Maintains the harbour lighthouse and rescues lost sailors.');
    const captain = await create('Mira Vale', 'entity', { entityType: 'character', species: link(species), home: link(port), faction: link(guild) }, 'An apprentice keeper determined to restore the beacon.');
    const item = await create('Dawn Lens', 'entity', { entityType: 'item', keeper: link(captain), location: link(port) }, 'A crystal lens that can rekindle the harbour beacon.');
    const first = await create('The Beacon Goes Dark', 'event', { date: { year: 100, day: 1 }, entities: [link(port), link(guild)] }, 'A storm extinguishes the beacon and closes the harbour.');
    const second = await create('The Dawn Lens Is Recovered', 'event', { date: { year: 100, day: 3 }, after: [link(first)], entities: [link(captain), link(item)] }, 'Mira recovers the lens from a flooded storeroom.');
    const third = await create('The Beacon Is Relit', 'event', { date: { year: 100, day: 4 }, after: [link(second)], entities: [link(port), link(guild), link(captain), link(item)] }, 'Mira restores the beacon and is appointed harbour keeper.');
    await call('read', { id: captain.id });
    const versionArgs = { frontmatter: { type: 'entity', title: captain.title, entityType: 'character', tags: ['test'], species: link(species), home: link(port), faction: link(guild), supersedes: link(captain), causedBy: link(third) }, body: 'Now harbour keeper of Port Lumen, Mira leads the Beacon Guild rescue watches.' };
    await call('validate', versionArgs);
    await call('create', versionArgs);
    await call('read', { id: port.id });
    await call('read', { id: captain.id });
    const invalid = await call('validate', { frontmatter: { type: 'entity', title: 'Invalid test candidate', entityType: 'charcter' } }, true);
    if (!invalid.isError) throw new Error('Invalid entity type was accepted');
    await call('validate');
    await call('timelines');
    await call('search', { query: 'beacon', tags: ['test'] });
  }
} finally {
  await writeFile('mcp-smoke-results.json', JSON.stringify(transcript, null, 2) + '\n');
  child.stdin.end();
  child.kill();
}
