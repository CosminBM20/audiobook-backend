const prisma = require('../lib/prisma');

function getPeriodKey(period) {
  const now = new Date();
  if (period === 'ONE_TIME') return 'all';
  if (period === 'DAILY') return now.toISOString().split('T')[0];
  if (period === 'MONTHLY') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  // WEEKLY — ISO week
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function updateStreak(userId) {
  const today = new Date().toISOString().split('T')[0];
  const streak = await prisma.userStreak.upsert({
    where: { userId },
    create: { userId, current: 1, longest: 1, lastActivity: new Date() },
    update: {},
  });
  const lastDay = streak.lastActivity?.toISOString().split('T')[0];
  if (lastDay === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (lastDay === yesterday) {
    const newCurrent = streak.current + 1;
    await prisma.userStreak.update({
      where: { userId },
      data: { current: newCurrent, longest: Math.max(newCurrent, streak.longest), lastActivity: new Date() },
    });
  } else if (streak.freezesAvailable > 0) {
    await prisma.userStreak.update({
      where: { userId },
      data: { freezesAvailable: { decrement: 1 }, lastActivity: new Date() },
    });
  } else {
    await prisma.userStreak.update({
      where: { userId },
      data: { current: 1, lastActivity: new Date() },
    });
  }
}

async function onListeningUpdate({ userId, previousPosition, newPosition, isCompleted, wasCompleted }) {
  const deltaMinutes = Math.max(0, (newPosition - (previousPosition || 0))) / 60;
  const justCompleted = isCompleted && !wasCompleted;
  if (deltaMinutes <= 0 && !justCompleted) return [];

  const newlyCompleted = [];
  const activeChallenges = await prisma.challenge.findMany({ where: { isActive: true, isArchived: false } });

  for (const ch of activeChallenges) {
    const key = getPeriodKey(ch.period);
    const uc = await prisma.userChallenge.upsert({
      where: { userId_challengeId_periodKey: { userId, challengeId: ch.id, periodKey: key } },
      create: { userId, challengeId: ch.id, periodKey: key, progress: 0 },
      update: {},
    });
    if (uc.isCompleted) continue;
    let increment = 0;
    if (ch.type === 'LISTENING_TIME') increment = deltaMinutes;
    if (ch.type === 'BOOKS_COMPLETED' && justCompleted) increment = 1;
    if (increment <= 0) continue;
    const newProgress = Math.min(uc.progress + increment, ch.target);
    const done = newProgress >= ch.target;
    await prisma.userChallenge.update({
      where: { id: uc.id },
      data: { progress: newProgress, isCompleted: done, completedAt: done ? new Date() : undefined },
    });
    if (done) {
      newlyCompleted.push({ title: ch.title, titleEn: ch.titleEn, badgeIcon: ch.badgeIcon, xpReward: ch.xpReward });
    }
  }

  await updateStreak(userId);
  return newlyCompleted;
}

module.exports = { onListeningUpdate, updateStreak, getPeriodKey };
