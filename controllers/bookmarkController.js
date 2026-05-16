const prisma = require('../lib/prisma');

exports.addBookmark = async (req, res) => {
  try {
    const { audiobookId, position, label } = req.body;
    const userId = req.user.userId;

    if (!audiobookId || position == null) {
      return res.status(400).json({ success: false, message: "audiobookId și position sunt obligatorii." });
    }

    const bookmark = await prisma.bookmark.create({
      data: { userId, audiobookId, position: Math.floor(position), label: label?.trim() || '' }
    });
    res.status(201).json({ success: true, data: bookmark });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBookmarks = async (req, res) => {
  try {
    const { audiobookId } = req.params;
    const userId = req.user.userId;
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId, audiobookId },
      orderBy: { position: 'asc' },
    });
    res.json({ success: true, data: bookmarks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    await prisma.bookmark.deleteMany({ where: { id, userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
