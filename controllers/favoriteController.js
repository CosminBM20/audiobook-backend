const prisma = require('../lib/prisma');

exports.getFavorites = async (req, res) => {
  try {
    const userId = req.user.userId;
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      select: { audiobookId: true },
    });
    res.json({ success: true, data: favorites.map(f => f.audiobookId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const { audiobookId } = req.body;
    const userId = req.user.userId;
    if (!audiobookId) return res.status(400).json({ success: false, message: 'audiobookId is required.' });
    const fav = await prisma.favorite.upsert({
      where: { userId_audiobookId: { userId, audiobookId } },
      update: {},
      create: { userId, audiobookId },
    });
    res.status(201).json({ success: true, data: fav });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const { audiobookId } = req.params;
    const userId = req.user.userId;
    await prisma.favorite.deleteMany({ where: { userId, audiobookId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Single endpoint that adds if absent, removes if present.
exports.toggleFavorite = async (req, res) => {
  try {
    const { audiobookId } = req.body;
    const userId = req.user.userId;
    if (!audiobookId) return res.status(400).json({ success: false, message: 'audiobookId is required.' });

    const existing = await prisma.favorite.findUnique({
      where: { userId_audiobookId: { userId, audiobookId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      res.json({ success: true, isFavorite: false });
    } else {
      await prisma.favorite.create({ data: { userId, audiobookId } });
      res.json({ success: true, isFavorite: true });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
