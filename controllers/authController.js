const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "Email deja utilizat." });

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, name, passwordHash: hashedPassword } });

    res.status(201).json({ success: true, message: "Cont creat cu succes!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    const isPasswordValid = user && await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Email sau parolă incorecte." });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, preferredVolume: user.preferredVolume } });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};
