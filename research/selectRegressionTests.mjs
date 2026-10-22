/** Select stable, high-value regression tests for each PR.
 * Tests never disappear: `npm test` remains the full 95-file suite.
 * Changed test files ALWAYS run. Modules pull related domain tests into
 * the PR gate; deep studies run in specialized or manual workflows. */
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';

const base=process.env.GITHUB_BASE_SHA || 'HEAD~1';
let changed=[];
try {
  changed=execFileSync('git',['diff','--name-only','--diff-filter=ACMR',base+'...HEAD'],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],
  }).trim().split('\n').filter(Boolean);
} catch {
  // A shallow checkout should not accidentally skip validation.
  changed=['main.js','unifiedGarageUI.js','combat.js','scene.js','audio.js'];
}
const always=[
  'stableFoundation','inventoryDuplicates','economy','contracts','campaign',
  'k3q1SortieAssignment','k3q2Series','damageFate','boutScoring','partEconomy',
  'salvageDraft','k3q2RoundBoundary',
];
const families=[
  {
    match:/^(?:unifiedGarageUI|garageBay|garageMountUI|sortieAssignment|seriesUI|sortieAssignmentUI|stable|campaign|acquisition|index|main|uiMeters|partGridUI)\.(?:js|html)$|^k4s.*\.css$|^ui.*\.css$/,
    tests:['k3s1GarageUX','k3q1SortieResetHygiene','k3w2PartialBayRecovery','k4s3DeployLayout'],
  },
  {
    match:/^(?:combat|locomotion|arena|frameShielding|damage|destruction|powerDynamics|scattergun|hostileRig|enemyMotion|tacticalAwareness)\w*\.js$|^ai\//,
    tests:['combatDepth','combatBalance','squadBattle','destructionCombat','k3t1Domination'],
  },
  {
    match:/^(?:audio|audioSystemsSynth|liveSystemsEvents|audioWarmup|sound)\w*\.js$/,
    tests:['k3w10LiveSystemsSoundscape','k3w11AcousticPerformance'],
  },
  {
    match:/^(?:scene|sceneAssembly|partVisuals|partMaterialPalette|paint|frameVisualKit|.*Visual|.*VisualKit)\w*\.js$/,
    tests:['partVisuals','damageVisuals','k4aMaterialRoles'],
  },
];
const selected=new Set(always.map(name=>'tests/'+name+'.test.mjs'));
for(const file of changed){
  if(/^tests\/[^/]+\.test\.mjs$/.test(file))selected.add(file);
  for(const family of families)if(family.match.test(file)){
    for(const name of family.tests)selected.add('tests/'+name+'.test.mjs');
  }
}
// Tests referenced in active PRs need never be silently dropped.
const results=[...selected].filter(path=>existsSync(path)).sort();
if(!results.length)throw Error('No PR tests selected');
if(process.argv.includes('--explain')){
  process.stderr.write('Changed files: '+changed.join(', ')+'\n');
  process.stderr.write('Selected '+results.length+' test files\n');
}
process.stdout.write(results.join('\n')+'\n');
