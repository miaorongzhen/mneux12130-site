import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); }
  catch (firstError) {
    const bundled = 'C:/Users/31617/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
    try { return require(bundled); }
    catch { throw firstError; }
  }
}

const { chromium } = loadPlaywright();

const edgeExecutable = process.env.EDGE_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const pageUrl = pathToFileURL(resolve('index.html')).href;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function baseState(overrides = {}) {
  return {
    realm: 0,
    hp: 80,
    qi: 24,
    cult: 0,
    demon: 0,
    silver: 30,
    herbs: 3,
    pages: 0,
    jade: 0,
    ore: 0,
    spirit: 0,
    contribution: 0,
    commissionsDone: 0,
    trialStage: 0,
    demonTrials: 0,
    reputation: 0,
    sect: '散修',
    selectedMap: 'woods',
    equipment: { weapon: 0, armor: 0 },
    skills: { qingmu: 1, stone: 0, sword: 1, step: 0, jade: 0 },
    insights: {},
    supplies: { hpPill: 0, qiPill: 0, ward: 0 },
    combat: null,
    pendingReward: null,
    pendingEncounter: null,
    log: ['smoke'],
    ...overrides
  };
}

async function loadState(page, state, randomValue = 0.5) {
  await page.evaluate(({ save, random }) => {
    Math.random = () => random;
    localStorage.setItem('fan-gu-wen-dao-save', JSON.stringify(save));
  }, { save: state, random: randomValue });
  await page.click('#loadBtn');
}

async function finishCombat(page, action = 'art', maxActions = 10) {
  for (let guard = 0; guard < maxActions && await page.locator('#combatBox').isVisible(); guard += 1) {
    await page.click(`[data-action=${action}]`);
  }
  await page.waitForSelector('#combatBox[hidden]');
}

async function clearExplorationReward(page, state, rewardChoice, label) {
  await loadState(page, state, 0.1);
  await page.click('#exploreBtn');
  await page.waitForSelector('#combatBox:not([hidden])');
  await finishCombat(page, 'art', 10);
  await page.waitForSelector('#rewardPanel:not([hidden])');
  await page.click(`[data-reward=${rewardChoice}]`);
  assert(await page.locator('#rewardPanel').evaluate((el) => el.hidden), `${label} reward panel did not close`);
}

async function clearOuterTrial(page, state, action, label) {
  await loadState(page, state);
  assert((await page.locator('#trialHint').textContent()).includes('4/4'), `${label} was not at final trial gate`);
  await page.click('#trialBtn');
  await page.waitForSelector('#combatBox:not([hidden])');
  await finishCombat(page, action, 10);
  assert((await page.locator('#sectPill').textContent()).includes('青云外门'), `${label} did not update sect`);
  assert((await page.locator('#mainTitle').textContent()).includes('外门已入'), `${label} did not update main title`);
  assert((await page.locator('#log').innerText()).includes('正式列名外门'), `${label} success was not logged`);
}

async function run() {
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: edgeExecutable });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(pageUrl);
  await page.waitForSelector('#adviceList .advice-card');
  assert(await page.locator('#builds .build-card').count() === 4, 'build cards did not render');
  assert(await page.locator('#insights .insight-card').count() === 6, 'insight cards did not render');
  assert(errors.length === 0, `page errors on initial load: ${errors.join('; ')}`);

  await page.evaluate(() => localStorage.setItem('fan-gu-wen-dao-save', JSON.stringify({
    realm: 1,
    hp: 90,
    qi: 20,
    cult: 100,
    silver: 40,
    herbs: 3,
    pages: 1,
    selectedMap: 'qingyun',
    skills: { qingmu: 3 }
  })));
  await page.click('#loadBtn');
  assert(await page.locator('#insights .insight-card').count() === 6, 'legacy save did not restore insight defaults');
  assert((await page.locator('#inventory').innerText()).includes('回春丹\n0'), 'legacy save did not restore supplies defaults');
  await page.click('#saveBtn');
  const migratedVersion = await page.evaluate(() => JSON.parse(localStorage.getItem('fan-gu-wen-dao-save')).saveVersion);
  assert(migratedVersion === 3, 'legacy save was not rewritten with current save version');

  await loadState(page, baseState({ realm: 1, hp: 125, qi: 38, sect: '青云杂役', herbs: 2 }), 0.9);
  await page.click('#exploreBtn');
  await page.waitForSelector('#encounterPanel:not([hidden])');
  assert(await page.locator('#encounterChoices .reward-choice').count() === 3, 'encounter choices did not render');
  await page.click('#cultivateBtn');
  assert((await page.locator('#log').innerText()).includes('先处理当前抉择'), 'pending encounter did not block cultivation');
  await page.click('[data-encounter=gather]');
  assert(await page.locator('#encounterPanel').evaluate((el) => el.hidden), 'encounter panel did not close after choice');
  assert((await page.locator('#inventory').innerText()).includes('药材\n5'), 'encounter reward was not applied');

  await loadState(page, baseState({ realm: 1, hp: 125, qi: 38, silver: 90, herbs: 6, pages: 2, spirit: 2, sect: '青云杂役' }));
  await page.click('#prepHpBtn');
  await page.click('#prepQiBtn');
  await page.click('#prepWardBtn');
  const inventoryAfterPrep = await page.locator('#inventory').innerText();
  assert(inventoryAfterPrep.includes('回春丹\n1') && inventoryAfterPrep.includes('回气丹\n1') && inventoryAfterPrep.includes('护身符\n1'), 'supplies were not prepared');

  await loadState(page, baseState({
    realm: 2,
    hp: 40,
    qi: 5,
    cult: 220,
    silver: 90,
    herbs: 4,
    pages: 1,
    spirit: 1,
    sect: '青云杂役',
    equipment: { weapon: 2, armor: 2 },
    skills: { qingmu: 4, stone: 4, sword: 4, step: 3, jade: 0 },
    supplies: { hpPill: 1, qiPill: 1, ward: 1 },
    combat: {
      enemyKey: 'wildDog',
      mode: 'normal',
      commissionId: '',
      trialStageIndex: -1,
      demonBefore: 0,
      enemyHp: 120,
      enemyMaxHp: 120,
      guard: false,
      poison: 0,
      playerGuard: false,
      playerStatus: { bleed: 2, poison: 2, stun: 0, sealed: 2, shield: 0, focus: 0 },
      enemyStatus: { bleed: 0, poison: 0, break: 0, stun: 0, shield: 0, rage: 0 }
    }
  }));
  await page.click('[data-action=hpPill]');
  await page.click('[data-action=qiPill]');
  await page.click('[data-action=ward]');
  const combatLog = await page.locator('#log').innerText();
  assert(combatLog.includes('回春丹') && combatLog.includes('回气丹') && combatLog.includes('护身符'), 'combat supply use did not log all effects');

  await loadState(page, baseState({
    realm: 2,
    hp: 175,
    qi: 70,
    cult: 260,
    demon: 85,
    pages: 2,
    sect: '青云外山记名',
    equipment: { weapon: 3, armor: 2 },
    skills: { qingmu: 6, stone: 5, sword: 8, step: 5, jade: 2 },
    insights: { leafVein: true, swordTrace: true },
    combat: {
      enemyKey: 'mindDemon',
      mode: 'demonSurge',
      commissionId: '',
      trialStageIndex: -1,
      demonBefore: 85,
      enemyHp: 8,
      enemyMaxHp: 160,
      guard: false,
      poison: 0,
      playerGuard: false,
      playerStatus: { bleed: 0, poison: 0, stun: 0, sealed: 0, shield: 0, focus: 0 },
      enemyStatus: { bleed: 0, poison: 0, break: 1, stun: 0, shield: 0, rage: 0 }
    }
  }));
  await page.click('[data-action=attack]');
  assert((await page.locator('#inventory').innerText()).includes('心魔劫\n1'), 'demon surge victory did not increment counter');

  await loadState(page, baseState({
    realm: 1,
    hp: 1,
    qi: 0,
    cult: 30,
    demon: 10,
    herbs: 2,
    silver: 30,
    skills: { qingmu: 0, stone: 0, sword: 1, step: 0, jade: 0 },
    combat: {
      enemyKey: 'wildDog',
      mode: 'normal',
      commissionId: '',
      trialStageIndex: -1,
      demonBefore: 0,
      enemyHp: 120,
      enemyMaxHp: 120,
      guard: false,
      poison: 0,
      playerGuard: false,
      playerStatus: { bleed: 0, poison: 1, stun: 0, sealed: 0, shield: 0, focus: 0 },
      enemyStatus: { bleed: 0, poison: 0, break: 0, stun: 0, shield: 0, rage: 0 }
    }
  }));
  await page.click('[data-action=attack]');
  await page.waitForSelector('#combatBox[hidden]');
  const defeatLog = await page.locator('#log').innerText();
  assert(defeatLog.includes('败给饿狼') && defeatLog.includes('心魔 +4'), 'defeat did not log recovery penalty');
  assert((await page.locator('#hpText').textContent()).includes('44/125'), 'defeat did not restore a playable hp floor');
  assert((await page.locator('#qiText').textContent()).includes('10/38'), 'defeat did not restore a playable qi floor');
  assert((await page.locator('#cultText').textContent()).includes('12/220'), 'defeat did not apply cultivation loss');
  assert((await page.locator('#demonText').textContent()).includes('15/100'), 'defeat did not add demon pressure');
  await page.click('#healBtn');
  assert((await page.locator('#hpText').textContent()).includes('84/125'), 'post-defeat healing did not work');
  assert((await page.locator('#demonText').textContent()).includes('14/100'), 'post-defeat healing did not reduce demon pressure');
  await page.click('#cultivateBtn');
  assert((await page.locator('#log').innerText()).includes('静修吐纳'), 'post-defeat state could not continue cultivation');

  await loadState(page, baseState({
    realm: 1,
    hp: 125,
    qi: 0,
    demon: 70,
    herbs: 2,
    silver: 24,
    skills: { qingmu: 4, stone: 0, sword: 1, step: 0, jade: 0 },
    insights: { leafVein: true }
  }));
  await page.click('#calmBtn');
  const calmInventory = await page.locator('#inventory').innerText();
  assert((await page.locator('#demonText').textContent()).includes('44/100'), 'calm demon did not reduce demon pressure');
  assert((await page.locator('#qiText').textContent()).includes('10/50'), 'calm demon did not restore qi');
  assert(calmInventory.includes('银钱\n12') && calmInventory.includes('药材\n1'), 'calm demon did not consume silver and herbs');

  await loadState(page, baseState({
    realm: 0,
    hp: 80,
    qi: 54,
    cult: 80,
    herbs: 2,
    equipment: { weapon: 3, armor: 0 },
    skills: { qingmu: 10, stone: 0, sword: 10, step: 0, jade: 0 }
  }));
  await page.click('#breakBtn');
  await page.waitForSelector('#combatBox:not([hidden])');
  await finishCombat(page, 'art');
  assert((await page.locator('#realmText').textContent()).includes('炼体'), 'body breakthrough did not advance realm');
  assert((await page.locator('#inventory').innerText()).includes('药材\n0'), 'body breakthrough did not consume herbs');

  await loadState(page, baseState({
    realm: 1,
    hp: 185,
    qi: 68,
    cult: 220,
    herbs: 5,
    spirit: 2,
    equipment: { weapon: 3, armor: 1 },
    skills: { qingmu: 10, stone: 2, sword: 10, step: 2, jade: 0 }
  }));
  await page.click('#breakBtn');
  await page.waitForSelector('#combatBox:not([hidden])');
  await finishCombat(page, 'art');
  const qiBreakInventory = await page.locator('#inventory').innerText();
  assert((await page.locator('#realmText').textContent()).includes('练气'), 'qi breakthrough did not advance realm');
  assert(qiBreakInventory.includes('药材\n0') && qiBreakInventory.includes('灵石\n0'), 'qi breakthrough did not consume herbs and spirit stones');

  await loadState(page, baseState({ realm: 1, hp: 125, qi: 38, herbs: 4, contribution: 2, sect: '青云杂役' }));
  await page.click('[data-commission=herbs]');
  await page.click('[data-commission=herbs]');
  const commissionInventory = await page.locator('#inventory').innerText();
  assert((await page.locator('#sectPill').textContent()).includes('青云外山记名'), 'support commissions did not promote sect rank');
  assert(commissionInventory.includes('贡献\n12') && commissionInventory.includes('委托\n2') && commissionInventory.includes('药材\n0'), 'support commissions did not convert herbs into contribution correctly');

  await loadState(page, baseState({ realm: 2, hp: 175, qi: 10, cult: 0, spirit: 1, skills: { qingmu: 6, stone: 0, sword: 1, step: 0, jade: 0 } }));
  await page.click('#refineBtn');
  const spiritInventory = await page.locator('#inventory').innerText();
  assert((await page.locator('#cultText').textContent()).includes('161/520'), 'spirit refining did not add the expected cultivation');
  assert((await page.locator('#qiText').textContent()).includes('88/88'), 'spirit refining did not refill qi');
  assert(spiritInventory.includes('灵石\n0'), 'spirit refining did not consume spirit stone');

  const strongExplorer = {
    realm: 2,
    hp: 280,
    qi: 108,
    silver: 80,
    herbs: 6,
    sect: '青云外山记名',
    equipment: { weapon: 3, armor: 3 },
    skills: { qingmu: 10, stone: 8, sword: 10, step: 6, jade: 0 },
    insights: { leafVein: true, swordTrace: true, steleBreath: true }
  };

  await clearExplorationReward(page, baseState({ ...strongExplorer, selectedMap: 'grave' }), 'risk', 'grave loot source');
  const graveInventory = await page.locator('#inventory').innerText();
  assert(graveInventory.includes('血玉\n2') && graveInventory.includes('残页\n1'), 'grave exploration did not source blood jade and pages');
  assert((await page.locator('#demonText').textContent()).includes('4/100'), 'grave exploration did not apply demon pressure from risky loot');

  await clearExplorationReward(page, baseState({ ...strongExplorer, selectedMap: 'ridge' }), 'risk', 'ridge ore source');
  assert((await page.locator('#inventory').innerText()).includes('矿石\n2'), 'ridge exploration did not source ore');

  await clearExplorationReward(page, baseState({ ...strongExplorer, selectedMap: 'qingyun' }), 'risk', 'qingyun contribution source');
  assert((await page.locator('#inventory').innerText()).includes('贡献\n6'), 'qingyun exploration did not source contribution');

  await clearExplorationReward(page, baseState({ ...strongExplorer, selectedMap: 'stele' }), 'loot', 'stele spirit source');
  const steleInventory = await page.locator('#inventory').innerText();
  assert(steleInventory.includes('灵石\n2') && steleInventory.includes('残页\n2'), 'stele exploration did not source spirit stones and pages');

  await loadState(page, baseState({
    realm: 2,
    hp: 175,
    qi: 70,
    cult: 260,
    demon: 5,
    contribution: 10,
    commissionsDone: 3,
    trialStage: 0,
    sect: '青云外山记名',
    equipment: { weapon: 3, armor: 2 },
    skills: { qingmu: 6, stone: 5, sword: 8, step: 5, jade: 2 },
    insights: { leafVein: true, swordTrace: true }
  }));
  await page.locator('[data-trial-stage]').nth(0).click();
  await page.waitForSelector('#combatBox:not([hidden])');
  for (let guard = 0; guard < 8 && await page.locator('#combatBox').isVisible(); guard += 1) {
    await page.click('[data-action=attack]');
  }
  await page.waitForSelector('#rewardPanel:not([hidden])');
  assert((await page.locator('#trialHint').textContent()).includes('1/4'), 'trial stage did not progress');

  await clearOuterTrial(page, baseState({
    realm: 2,
    hp: 280,
    qi: 108,
    cult: 520,
    demon: 5,
    silver: 160,
    herbs: 10,
    pages: 5,
    jade: 0,
    ore: 4,
    spirit: 6,
    contribution: 24,
    commissionsDone: 4,
    trialStage: 4,
    demonTrials: 1,
    reputation: 30,
    sect: '青云外山记名',
    selectedMap: 'qingyun',
    equipment: { weapon: 3, armor: 3 },
    skills: { qingmu: 10, stone: 10, sword: 10, step: 10, jade: 0 },
    insights: { leafVein: true, rockMirror: true, swordTrace: true, cloudStep: true, steleBreath: true },
    supplies: { hpPill: 2, qiPill: 2, ward: 2 }
  }), 'art', 'righteous outer trial route');

  await clearOuterTrial(page, baseState({
    realm: 2,
    hp: 270,
    qi: 110,
    cult: 520,
    demon: 45,
    silver: 120,
    herbs: 8,
    pages: 6,
    jade: 6,
    ore: 2,
    spirit: 5,
    contribution: 24,
    commissionsDone: 4,
    trialStage: 4,
    demonTrials: 1,
    reputation: 22,
    sect: '青云外山记名',
    selectedMap: 'qingyun',
    equipment: { weapon: 3, armor: 2 },
    skills: { qingmu: 7, stone: 6, sword: 8, step: 6, jade: 6 },
    insights: { leafVein: true, swordTrace: true, cloudStep: true, bloodOath: true, steleBreath: true },
    supplies: { hpPill: 2, qiPill: 2, ward: 2 }
  }), 'jade', 'blood jade outer trial route');

  assert(errors.length === 0, `page errors: ${errors.join('; ')}`);
  await browser.close();
  console.log('smoke test ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
