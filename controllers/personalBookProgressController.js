const prisma = require('../lib/prisma');

exports.getProgress = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  try {
    const progress = await prisma.personalBookProgress.findUnique({
      where: { userId_personalBookId: { userId, personalBookId: id } },
    });
    res.json({ success: true, data: progress ?? null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.upsertProgress = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const { charOffset, totalChars, isCompleted } = req.body;
  try {
    const book = await prisma.personalBook.findFirst({ where: { id, userId } });
    if (!book) return res.status(404).json({ success: false, message: 'Document negăsit.' });

    const progress = await prisma.personalBookProgress.upsert({
      where: { userId_personalBookId: { userId, personalBookId: id } },
      update: {
        ...(charOffset  !== undefined && { charOffset }),
        ...(totalChars  !== undefined && { totalChars }),
        ...(isCompleted !== undefined && { isCompleted }),
        lastPlayedAt: new Date(),
      },
      create: {
        userId,
        personalBookId: id,
        charOffset:  charOffset  ?? 0,
        totalChars:  totalChars  ?? 0,
        isCompleted: isCompleted ?? false,
        lastPlayedAt: new Date(),
      },
    });
    res.json({ success: true, data: progress });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
