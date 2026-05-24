const prisma  = require('../lib/prisma');
const bcrypt  = require('bcryptjs');

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

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const updateData = {};

    if (name?.trim()) updateData.name = name.trim();

    if (email?.trim() && email.trim() !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
      if (existing) return res.status(400).json({ success: false, message: 'Email deja utilizat de un alt cont.' });
      updateData.email = email.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Parola curentă este necesară pentru schimbarea parolei.' });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ success: false, message: 'Parola curentă este incorectă.' });
      if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Parola nouă trebuie să aibă cel puțin 6 caractere.' });
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ success: true, message: 'Nicio modificare detectată.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
