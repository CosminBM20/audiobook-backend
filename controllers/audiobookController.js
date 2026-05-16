const prisma = require('../lib/prisma');
const stream = require('stream');
const { cloudinary } = require('../config/cloudinary');
const mm = require('music-metadata');

const uploadFromBuffer = (buffer, folder, resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    bufferStream.pipe(uploadStream);
  });
};

exports.getAllAudiobooks = async (req, res) => {
  try {
    const audiobooks = await prisma.audiobook.findMany({ include: { author: true, category: true } });
    res.status(200).json({ success: true, data: audiobooks });
  } catch (error) {
    res.status(500).json({ success: false, message: "Eroare de server." });
  }
};

exports.getAudiobookById = async (req, res) => {
  try {
    const { id } = req.params; 
    const audiobook = await prisma.audiobook.findUnique({
      where: { id: id },
      include: { author: true, category: true }
    });
    if (!audiobook) return res.status(404).json({ success: false, message: "Nu a fost găsit." });
    res.status(200).json({ success: true, data: audiobook });
  } catch (error) {
    res.status(500).json({ success: false, message: "Eroare de server." });
  }
};

exports.saveProgress = async (req, res) => {
  try {
    const { audiobookId, currentPosition } = req.body;
    const userId = req.user.userId;
    const progress = await prisma.listeningProgress.upsert({
      where: { userId_audiobookId: { userId, audiobookId } },
      update: { currentPosition, lastListened: new Date() },
      create: { userId, audiobookId, currentPosition, lastListened: new Date() },
    });
    res.json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const { audiobookId } = req.params;
    const userId = req.user.userId;
    const progress = await prisma.listeningProgress.findUnique({
      where: { userId_audiobookId: { userId, audiobookId } }
    });
    res.json({ success: true, lastPosition: progress ? progress.currentPosition : 0 }); 
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userProgress = await prisma.listeningProgress.findMany({
      where: { userId },
      include: { audiobook: { include: { author: true, category: true } } },
      orderBy: { lastListened: 'desc' },
    });
    res.json({ success: true, data: userProgress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getActivity = async (req, res) => {
  try {
    const userId = req.user.userId;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await prisma.listeningProgress.findMany({
      where: { userId, lastListened: { gte: since } },
      select: { lastListened: true },
    });

    const byDay = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const count = rows.filter(r => r.lastListened.toISOString().slice(0, 10) === key).length;
      return {
        day: d.toLocaleDateString('ro-RO', { weekday: 'short' }),
        count,
      };
    });

    res.json({ success: true, data: byDay });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const progress = await prisma.listeningProgress.findMany({
      where: { userId },
      include: { audiobook: { include: { category: true } } },
    });

    const totalSeconds = progress.reduce((sum, p) => sum + p.currentPosition, 0);
    const completed    = progress.filter(p => p.isCompleted).length;
    const byCategory   = progress.reduce((acc, p) => {
      const cat = p.audiobook.category.name;
      acc[cat] = (acc[cat] || 0) + p.currentPosition;
      return acc;
    }, {});

    res.json({ success: true, data: { totalSeconds, booksStarted: progress.length, completed, byCategory } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAudiobook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await prisma.audiobook.findUnique({ where: { id } });
    if (!book) return res.status(404).json({ success: false, message: 'Cartea nu a fost găsită.' });

    // Delete all user data tied to this book before deleting the book itself
    await prisma.$transaction([
      prisma.listeningProgress.deleteMany({ where: { audiobookId: id } }),
      prisma.bookmark.deleteMany({ where: { audiobookId: id } }),
      prisma.listenLater.deleteMany({ where: { audiobookId: id } }),
      prisma.favorite.deleteMany({ where: { audiobookId: id } }),
      prisma.audiobook.delete({ where: { id } }),
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAudiobook = async (req, res) => {
  try {
    const { title, authorName, categoryName, description } = req.body;

    if (!title?.trim() || !authorName?.trim() || !categoryName?.trim()) {
      return res.status(400).json({ success: false, message: "Titlul, autorul și categoria sunt obligatorii." });
    }

    if (!req.files || !req.files.coverImage || !req.files.audioFile) {
      return res.status(400).json({ success: false, message: "Lipsește coperta sau fișierul audio!" });
    }

    // Auto-detect duration from audio buffer
    let parsedDuration = 0;
    try {
      const metadata = await mm.parseBuffer(
        req.files.audioFile[0].buffer,
        { mimeType: req.files.audioFile[0].mimetype }
      );
      parsedDuration = Math.round(metadata.format.duration || 0);
    } catch (err) {
      console.warn('music-metadata parse failed:', err.message);
    }
    if (!parsedDuration || parsedDuration <= 0) {
      return res.status(400).json({ success: false, message: "Nu s-a putut detecta durata fișierului audio. Verifică formatul fișierului." });
    }

    console.log("Începe upload-ul către Cloudinary...");
    const coverResult = await uploadFromBuffer(req.files.coverImage[0].buffer, 'audiobooks/covers', 'image');
    const audioResult = await uploadFromBuffer(req.files.audioFile[0].buffer, 'audiobooks/audio', 'video'); 

    console.log("Upload complet! Salvăm în baza de date...");

    let author = await prisma.author.findFirst({ where: { name: authorName } });
    if (!author) {
      author = await prisma.author.create({ 
        data: { 
          name: authorName 
        } 
      });
    }
    let category = await prisma.category.findFirst({ where: { name: categoryName } });
    if (!category) category = await prisma.category.create({ data: { name: categoryName } });

    const newAudiobook = await prisma.audiobook.create({
      data: {
        title: title,
        description: description || "",
        durationSeconds: parsedDuration,
        coverImageUrl: coverResult.secure_url,
        audioFileUrl: audioResult.secure_url, // <-- AM MODIFICAT AICI (din audioUrl în audioFileUrl)
        authorId: author.id,
        categoryId: category.id
      },
      include: { author: true, category: true }
    });

    res.status(201).json({ success: true, data: newAudiobook });
  } catch (error) {
    console.error("Eroare la creare audiobook:", error);
    res.status(500).json({ success: false, message: "Eroare la adăugarea cărții." });
  }
};