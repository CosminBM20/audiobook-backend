const prisma = require('../lib/prisma');

exports.getListenLater = async (req, res) => {
  try {
    const userId = req.user.userId;
    const items = await prisma.listenLater.findMany({
      where: { userId },
      include: { audiobook: { include: { author: true, category: true } } },
      orderBy: { addedAt: 'asc' },
    });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addToListenLater = async (req, res) => {
  try {
    const { audiobookId } = req.body;
    const userId = req.user.userId;
    if (!audiobookId) return res.status(400).json({ success: false, message: 'audiobookId este obligatoriu.' });

    const item = await prisma.listenLater.upsert({
      where: { userId_audiobookId: { userId, audiobookId } },
      update: {},
      create: { userId, audiobookId },
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeFromListenLater = async (req, res) => {
  try {
    const { audiobookId } = req.params;
    const userId = req.user.userId;
    await prisma.listenLater.deleteMany({ where: { userId, audiobookId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
