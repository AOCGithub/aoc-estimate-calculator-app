// Run through Vercel env run. Values travel over stdin, never command arguments or logs.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const project=JSON.parse(await readFile(new URL('../../.vercel/project.json',import.meta.url),'utf8'));
if(!/^prj_[a-zA-Z0-9]+$/.test(project.projectId||''))throw new Error('Link this repository to its Vercel project first.');
const scope='aocs-projects-b933e3ab';
function add(name,value,sensitive=false){
  const command=`npx --yes vercel@65.7.0 env add ${name} --environment production --project ${project.projectId} --scope ${scope} --yes --force ${sensitive?'--sensitive':'--no-sensitive'}`;
  const result=process.platform==='win32'
    ? spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',command],{input:value,encoding:'utf8',windowsHide:true})
    : spawnSync('npx',['--yes','vercel@65.7.0','env','add',name,'--environment','production','--project',project.projectId,'--scope',scope,'--yes','--force',sensitive?'--sensitive':'--no-sensitive'],{input:value,encoding:'utf8'});
  if(result.status!==0)throw new Error('Could not configure '+name+'. Check Vercel access; no deployment was performed.');
  console.log('Configured server setting: '+name);
}
const existingSecret=String(process.env.CRON_SECRET||'');
// Sensitive values cannot be downloaded by env run. Check metadata before
// deciding a secret is absent, so rerunning setup never rotates an existing key.
const inventoryCommand=`npx --yes vercel@65.7.0 env ls --environment production --scope ${scope}`;
const inventory=process.platform==='win32'
  ? spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',inventoryCommand],{encoding:'utf8',windowsHide:true})
  : spawnSync('npx',['--yes','vercel@65.7.0','env','ls','--environment','production','--scope',scope],{encoding:'utf8'});
if(inventory.status!==0)throw new Error('Could not inspect production environment metadata. Existing secrets were not changed.');
const secretExists=/\bCRON_SECRET\b/.test(inventory.stdout);
if(existingSecret&&existingSecret.length<32)throw new Error('Existing CRON_SECRET is shorter than 32 characters; review it before replacing a shared secret.');
if(!existingSecret&&!secretExists)add('CRON_SECRET',randomBytes(32).toString('base64url'),true);
else console.log('Kept the existing server-only cleanup secret.');
add('AOC_CLIENT_PROFILES_ENABLED','true');
add('AOC_CLIENT_PROFILE_TTL_DAYS',String(process.env.AOC_CLIENT_PROFILE_TTL_DAYS||30));
add('AOC_LOCAL_CLIENT_PROFILES_ENABLED','false');
console.log('Production settings prepared for the next deployment. Current deployed code was not changed.');
