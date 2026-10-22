/**
 * RESEARCH / FUTURE OPPONENT DESIGN.
 * Pure knobs for reproducible tactical experiments. No item stats, physics,
 * hidden contacts or damage rules are modified by these profiles.
 *
 * These are hypotheses, NOT balanced difficulty ratings or player-facing
 * faction assignments. Only the baseline is active in live gameplay.
 */
const make=(id,label,description,weights={},pilot={})=>Object.freeze({
  id,label,description,
  weights:Object.freeze({
    capture:0,defend:0,contest:0,screen:0,
    neutral:0,enemyOwned:0,contested:0,threatened:0,
    duplication:1,travel:1,switching:1,...weights
  }),
  pilot:Object.freeze({
    woundThreshold:.30,woundExposure:1.4,commitment:1,
    cautiousApproach:false,...pilot
  })
});
export const AI_RESEARCH_PROFILES=Object.freeze({
  baseline:make('baseline','Balanced','Current unmodified team and pilot policy'),
  blitz:make('blitz','Blitz','Fast early capture, frequent committed assaults',
    {capture:.25,contest:.20,neutral:.18,defend:-.13,
      travel:.70,duplication:.92,switching:.70},
    {commitment:.78,woundThreshold:.22,woundExposure:2.25}),
  fortress:make('fortress','Fortress','Protect paying ground and avoid wasteful raids',
    {defend:.32,contest:-.08,screen:.12,duplication:1.28,
      switching:1.45,travel:1.12},
    {commitment:1.38,woundThreshold:.38,woundExposure:.95}),
  wolfpack:make('wolfpack','Wolfpack','Concentrate assault pressure on enemy footholds',
    {contest:.26,enemyOwned:.17,screen:.22,defend:-.12,
      duplication:.36,switching:.74,travel:.83},
    {commitment:.95,woundThreshold:.24,woundExposure:1.9}),
  skirmish:make('skirmish','Skirmish','Spread widely across uncontested objectives',
    {capture:.23,neutral:.19,contest:-.12,screen:-.11,
      duplication:1.8,travel:.62,switching:.84},
    {commitment:.9,woundThreshold:.33,woundExposure:1.12}),
  cautious:make('cautious','Cautious','Favor survival, cover and safer territory transitions',
    {defend:.12,capture:.11,contest:-.18,contested:-.12,
      threatened:-.12,duplication:1.18,travel:1.04,switching:1.20},
    {commitment:1.16,woundThreshold:.44,woundExposure:.65,cautiousApproach:true}),
  reactive:make('reactive','Reactive','Reinforce threatened positions and contest intrusions',
    {contest:.18,screen:.21,contested:.19,threatened:.18,
      duplication:.83,switching:.62},
    {commitment:.76,woundThreshold:.33,woundExposure:.85}),
  opportunist:make('opportunist','Opportunist','Choose weakly defended zones and rotate efficiently',
    {capture:.15,neutral:.26,enemyOwned:-.05,contest:.06,
      threatened:-.18,duplication:1.36,travel:.76,switching:.48},
    {commitment:.70,woundThreshold:.30,woundExposure:1.35}),
});
export function getAiResearchProfile(id='baseline'){
  const entry=AI_RESEARCH_PROFILES[id];
  if(!entry)throw new RangeError('Unknown AI strategy: '+id);
  return entry;
}
export function listAiResearchProfiles(){
  return Object.values(AI_RESEARCH_PROFILES);
}

/** Difficulty affects decision timing and physical aiming proficiency, not
 * health, speed, damage, ammunition, capture rules or omniscient sensors. */
export const AI_RESEARCH_DIFFICULTIES=Object.freeze({
  rookie:Object.freeze({id:'rookie',label:'Rookie circuit',planningSeconds:1.45,
    perceptionSeconds:.28,acquisitionDelay:1.00,spreadScale:1.42}),
  club:Object.freeze({id:'club',label:'Underground regular',planningSeconds:1.05,
    perceptionSeconds:.20,acquisitionDelay:.72,spreadScale:1.16}),
  pro:Object.freeze({id:'pro',label:'Regional contender',planningSeconds:.85,
    perceptionSeconds:.15,acquisitionDelay:.50,spreadScale:1}),
  elite:Object.freeze({id:'elite',label:'Corporate ace',planningSeconds:.65,
    perceptionSeconds:.12,acquisitionDelay:.30,spreadScale:.84})
});
export function getAiResearchDifficulty(id='pro'){
  const entry=AI_RESEARCH_DIFFICULTIES[id];
  if(!entry)throw new RangeError('Unknown AI difficulty: '+id);
  return entry;
}
/** Shortlist of future faction voices. Narrative labels do not grant bonuses. */
export const AI_FACTION_CONCEPTS=Object.freeze([
  Object.freeze({id:'yard-crew',label:'Yard Crew',strategy:'blitz',difficulty:'rookie'}),
  Object.freeze({id:'scrap-union',label:'Scrap Union',strategy:'fortress',difficulty:'club'}),
  Object.freeze({id:'dust-hounds',label:'Dust Hounds',strategy:'wolfpack',difficulty:'club'}),
  Object.freeze({id:'road-runners',label:'Road Runners',strategy:'skirmish',difficulty:'pro'}),
  Object.freeze({id:'salvage-guard',label:'Salvage Guard',strategy:'reactive',difficulty:'pro'}),
  Object.freeze({id:'factory-team',label:'Factory Team',strategy:'opportunist',difficulty:'elite'})
]);
