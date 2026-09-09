importScripts('js/state.js');

const RULE_ID_BASE = 1000;

function buildRules(blockedSites) {
  return blockedSites.map((site, i) => ({
    id: RULE_ID_BASE + i,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: `/blocked.html?site=${encodeURIComponent(site)}` },
    },
    condition: {
      urlFilter: `||${site}^`,
      resourceTypes: ['main_frame'],
    },
  }));
}

async function syncBlockingRules(state) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  const addRules = state.locked ? buildRules(state.plan.blockedSites || []) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function refresh() {
  const state = await TOL.loadState();
  await syncBlockingRules(state);
}

chrome.runtime.onInstalled.addListener(() => {
  refresh();
  chrome.alarms.create('day-check', { periodInMinutes: 15 });
});

chrome.runtime.onStartup.addListener(() => {
  refresh();
  chrome.alarms.create('day-check', { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'day-check') refresh();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[TOL.STORAGE_KEY]) {
    const newState = changes[TOL.STORAGE_KEY].newValue;
    if (newState) syncBlockingRules(newState);
  }
});
