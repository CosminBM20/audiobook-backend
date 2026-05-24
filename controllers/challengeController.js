const prisma = require('../lib/prisma');
const { getPeriodKey } = require('../services/challengeProgressService');

// GET /api/challenges — user's active challenges with progress
exports.getChallenges = async (req, res) => {
  try {
    const userId = req.user.userId;
    const challenges = await prisma.challenge.findMany({
      where: { isActive: true, isArchived: false },
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
    });
    const result = await Promise.all(challenges.map(async ch => {
      const key = getPeriodKey(ch.period);
      const uc = await prisma.userChallenge.findUnique({
        where: { userId_challengeId_periodKey: { userId, challengeId: ch.id, periodKey: key } },
      });
      return {
        id: ch.id,
        title: ch.title,
        titleEn: ch.titleEn,
        description: ch.description,
        descriptionEn: ch.descriptionEn,
        type: ch.type,
        difficulty: ch.difficulty,
        period: ch.period,
        target: ch.target,
        xpReward: ch.xpReward,
        badgeIcon: ch.badgeIcon,
        progress: uc?.progress ?? 0,
        isCompleted: uc?.isCompleted ?? false,
        completedAt: uc?.completedAt ?? null,
      };
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/challenges/streak
exports.getStreak = async (req, res) => {
  try {
    const userId = req.user.userId;
    const streak = await prisma.userStreak.findUnique({ where: { userId } });
    res.json({ success: true, data: streak ?? { current: 0, longest: 0, lastActivity: null, freezesAvailable: 1 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN CRUD ────────────────────────────────────────────────────────────────

// GET /api/challenges/admin — all challenges with completion stats
exports.getAdminChallenges = async (req, res) => {
  try {
    const challenges = await prisma.challenge.findMany({
      where: { isArchived: false },
      include: {
        _count: { select: { userProgress: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const result = await Promise.all(challenges.map(async ch => {
      const completedCount = await prisma.userChallenge.count({
        where: { challengeId: ch.id, isCompleted: true },
      });
      return {
        ...ch,
        participantCount: ch._count.userProgress,
        completedCount,
        completionRate: ch._count.userProgress > 0
          ? Math.round((completedCount / ch._count.userProgress) * 100)
          : 0,
      };
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/challenges — create
exports.createChallenge = async (req, res) => {
  try {
    const { title, titleEn, description, descriptionEn, type, difficulty, target, period, xpReward, badgeIcon, startsAt, endsAt, categoryFilter } = req.body;
    const userId = req.user.userId;
    const ch = await prisma.challenge.create({
      data: {
        title, titleEn: titleEn || '', description, descriptionEn: descriptionEn || '',
        type, difficulty,
        target: parseFloat(target),
        period,
        xpReward: parseInt(xpReward) || 0,
        badgeIcon: badgeIcon || '🏆',
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        categoryFilter: categoryFilter || null,
        createdById: userId,
        isActive: false,
      },
    });
    res.status(201).json({ success: true, data: ch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/challenges/:id — update
exports.updateChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, titleEn, description, descriptionEn, type, difficulty, target, period, xpReward, badgeIcon, isActive, startsAt, endsAt } = req.body;
    const ch = await prisma.challenge.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(titleEn !== undefined && { titleEn }),
        ...(description !== undefined && { description }),
        ...(descriptionEn !== undefined && { descriptionEn }),
        ...(type !== undefined && { type }),
        ...(difficulty !== undefined && { difficulty }),
        ...(target !== undefined && { target: parseFloat(target) }),
        ...(period !== undefined && { period }),
        ...(xpReward !== undefined && { xpReward: parseInt(xpReward) }),
        ...(badgeIcon !== undefined && { badgeIcon }),
        ...(isActive !== undefined && { isActive }),
        ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
        ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
      },
    });
    res.json({ success: true, data: ch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/challenges/:id/toggle — flip isActive
exports.toggleChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const ch = await prisma.challenge.findUnique({ where: { id } });
    if (!ch) return res.status(404).json({ success: false, message: 'Not found' });
    const updated = await prisma.challenge.update({ where: { id }, data: { isActive: !ch.isActive } });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/challenges/:id — archive (soft delete)
exports.archiveChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.challenge.update({ where: { id }, data: { isArchived: true, isActive: false } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
