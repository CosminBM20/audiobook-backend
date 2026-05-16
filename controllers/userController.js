const prisma = require('../lib/prisma');

exports.updateVolume = async (req, res) => {
  try {
    const vol = parseFloat(req.body.preferredVolume);
    if (isNaN(vol) || vol < 0 || vol > 1) {
      return res.status(400).json({ message: 'preferredVolume must be between 0 and 1.' });
    }
    await prisma.user.update({
      where: { id: req.user.userId },
      data:  { preferredVolume: vol },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
