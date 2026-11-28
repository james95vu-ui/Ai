'use strict';

const Tycoon = (() => {
  const baseEnergyTick = 1100;
  const chestCooldown = 4 * 60 * 60 * 1000;
  const maxUpgrade = 30;
  const tech = [
    {id: 'yield', name: 'Городская экономика', price: 1, effect: '+15% к пассивному доходу'},
    {id: 'power', name: 'Новая электросеть', price: 2, requires: 'yield', effect: '+20 к запасу энергии'},
    {id: 'workforce', name: 'Кадровый резерв', price: 3, requires: 'yield', effect: '+50% к доходу от менеджеров'}
  ];
  const rewards = [
    {weight: 65, coins: 250, energy: 0},
    {weight: 25, coins: 400, energy: 12},
    {weight: 10, coins: 800, energy: 25}
  ];

  function normalize(state, now) {
    state.tycoon ||= {};
    const t = state.tycoon;
    t.technologies ||= [];
    t.points ??= 0;
    t.energy ??= energyCap(t);
    t.energyAt ??= now;
    t.nextChest ??= 0;
    t.energyUpgrades = Math.max(0, Math.min(30, Math.trunc(Number(t.energyUpgrades)||0)));
    return t;
  }

  function energyCap(t) {
    return (t.technologies.includes('power') ? 200 : 180) + 10 * (t.energyUpgrades || 0);
  }

  function recharge(t, now) {
    const cap = energyCap(t);
    if (now < t.energyAt) return;
    const energyTick = Math.max(500,baseEnergyTick-60*(t.regenLevel||0));
    const ticks = Math.floor((now - t.energyAt) / energyTick);
    t.energy = Math.min(cap, t.energy + ticks);
    t.energyAt = t.energy === cap ? now : t.energyAt + ticks * energyTick;
  }

  function spendEnergy(t, amount, now) {
    recharge(t, now);
    if (t.energy < amount) return false;
    t.energy -= amount;
    return true;
  }

  function price(base, level) {
    return Math.ceil(base * 1.5 ** level);
  }

  function hourlyBonus(t, campaign, buildings) {
    let bonus = 0;
    for (const city of Object.values(campaign)) {
      for (const name of city.built) {
        const project = buildings.find(building => building[0] === name);
        if (!project) continue;
        const upgrades = city.upgrades?.[name] || 0;
        bonus += project[3] * upgrades * .25;
        if (city.managers?.[name]) {
          bonus += project[3] * (1 + upgrades * .25) * (t.technologies.includes('workforce') ? .75 : .5);
        }
      }
    }
    return bonus;
  }

  function chest(t, now, roll) {
    if (now < t.nextChest) return null;
    t.nextChest = now + chestCooldown;
    let weight = roll * 100;
    const reward = rewards.find(item => (weight -= item.weight) < 0) || rewards.at(-1);
    recharge(t, now);
    t.energy = Math.min(energyCap(t), t.energy + reward.energy);
    return reward;
  }

  return {normalize, energyCap, recharge, spendEnergy, price, hourlyBonus, chest, maxUpgrade, tech};
})();
