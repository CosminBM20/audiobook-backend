const prisma = require('../lib/prisma');
const stream = require('stream');
const { cloudinary } = require('../config/cloudinary');
const mm = require('music-metadata');
const { onListeningUpdate } = require('../services/challengeProgressService');

/** Accepted language values. Anything outside this set defaults to 'ro'. */
const VALID_LANGUAGES = new Set(['ro', 'en']);

/**
 * Returns the language value if it is in the allowlist, otherwise 'ro'.
 * Prevents arbitrary strings from leaking into the language column and
 * ensures the frontend filter (book.language === 'en') never silently
 * matches books that were meant to be Romanian.
 */
function sanitizeLanguage(lang) {
  return VALID_LANGUAGES.has(lang) ? lang : 'ro';
}

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
    const { search, page, limit } = req.query;

    const hasSearch     = typeof search === 'string' && search.trim().length > 0;
    const hasPagination = page !== undefined || limit !== undefined;

    // ── Backward-compatible default ──────────────────────────────────────────
    // No query params → byte-for-byte the original query so the existing
    // homepage (which calls GET /api/audiobooks with no params) is unchanged.
    if (!hasSearch && !hasPagination) {
      const audiobooks = await prisma.audiobook.findMany({ include: { author: true, category: true } });
      return res.status(200).json({ success: true, data: audiobooks });
    }

    // ── Optional case-insensitive search across title/description/author/category ─
    const term = hasSearch ? search.trim() : null;
    const where = term
      ? {
          OR: [
            { title:       { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { author:   { is: { name: { contains: term, mode: 'insensitive' } } } },
            { category: { is: { name: { contains: term, mode: 'insensitive' } } } },
          ],
        }
      : {};

    // ── Search without pagination → filtered list, same envelope as before ───
    if (!hasPagination) {
      const audiobooks = await prisma.audiobook.findMany({
        where,
        include: { author: true, category: true },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json({ success: true, data: audiobooks });
    }

    // ── Opt-in pagination ────────────────────────────────────────────────────
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const skip     = (pageNum - 1) * limitNum;

    const [audiobooks, total] = await Promise.all([
      prisma.audiobook.findMany({
        where,
        include: { author: true, category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.audiobook.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: audiobooks,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Eroare de server." });
  }
};

exports.getAudiobookById = async (req, res) => {
  try {
    const { id } = req.params;
    const audiobook = await prisma.audiobook.findUnique({
      where: { id },
      include: { author: true, category: true, chapters: { orderBy: { order: 'asc' } } }
    });
    if (!audiobook) return res.status(404).json({ success: false, message: "Nu a fost găsit." });
    res.status(200).json({ success: true, data: audiobook });
  } catch (error) {
    res.status(500).json({ success: false, message: "Eroare de server." });
  }
};

exports.updateAudiobook = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, authorName, categoryName, description, language } = req.body;

    const book = await prisma.audiobook.findUnique({ where: { id } });
    if (!book) return res.status(404).json({ success: false, message: 'Cartea nu a fost găsită.' });

    let coverImageUrl = book.coverImageUrl;
    if (req.files?.coverImage?.[0]) {
      const result = await uploadFromBuffer(req.files.coverImage[0].buffer, 'audiobooks/covers', 'image');
      coverImageUrl = result.secure_url;
    }

    const [author, category] = await Promise.all([
      authorName?.trim()
        ? prisma.author.upsert({ where: { name: authorName.trim() }, update: {}, create: { name: authorName.trim() } })
        : null,
      categoryName?.trim()
        ? prisma.category.upsert({ where: { name: categoryName.trim() }, update: {}, create: { name: categoryName.trim() } })
        : null,
    ]);
    const authorId   = author?.id   ?? book.authorId;
    const categoryId = category?.id ?? book.categoryId;

    const updated = await prisma.audiobook.update({
      where: { id },
      data: {
        ...(title?.trim()                  && { title: title.trim() }),
        ...(description != null            && { description }),
        // Only update language when the field is explicitly provided in the request;
        // undefined means the client didn't touch it and we keep the existing value.
        ...(language !== undefined ? { language: sanitizeLanguage(language) } : {}),
        coverImageUrl,
        authorId,
        categoryId,
      },
      include: { author: true, category: true },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Eroare la actualizare audiobook:', error);
    res.status(500).json({ success: false, message: 'Eroare la actualizare.' });
  }
};

exports.saveProgress = async (req, res) => {
  try {
    const { audiobookId, currentPosition: rawPosition } = req.body;

    if (typeof rawPosition !== 'number' || !Number.isFinite(rawPosition) || rawPosition < 0) {
      return res.status(400).json({ success: false, message: 'currentPosition must be a non-negative number.' });
    }

    const userId = req.user.userId;

    const [audiobook, existing] = await Promise.all([
      prisma.audiobook.findUnique({
        where: { id: audiobookId },
        select: { durationSeconds: true },
      }),
      prisma.listeningProgress.findUnique({
        where: { userId_audiobookId: { userId, audiobookId } },
        select: { currentPosition: true, isCompleted: true },
      }),
    ]);

    if (!audiobook) {
      return res.status(404).json({ success: false, message: 'Audiobook not found.' });
    }

    // Clamp to the book's actual duration — without this, a client could report
    // an arbitrary position and instantly mark any book "completed", farming
    // gamification XP/badges with zero real playback.
    const currentPosition = audiobook.durationSeconds > 0
      ? Math.min(rawPosition, audiobook.durationSeconds)
      : rawPosition;

    const isCompleted = audiobook.durationSeconds > 0 && currentPosition >= audiobook.durationSeconds * 0.97;

    const progress = await prisma.listeningProgress.upsert({
      where: { userId_audiobookId: { userId, audiobookId } },
      update: {
        currentPosition,
        lastListened: new Date(),
        ...(isCompleted && { isCompleted: true }),
      },
      create: { userId, audiobookId, currentPosition, isCompleted, lastListened: new Date() },
    });

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SCREENSHOT: Listing 4.5 — Cuplare slabă prin try-catch     ║
    // ║  Capturați de la 'let newlyCompleted' până la res.json(...)  ║
    // ╚══════════════════════════════════════════════════════════════╝
    let newlyCompleted = [];
    try {
      newlyCompleted = await onListeningUpdate({
        userId,
        previousPosition: existing?.currentPosition ?? 0,
        newPosition: currentPosition,
        isCompleted,
        wasCompleted: existing?.isCompleted ?? false,
      });
    } catch {}

    res.json({ success: true, progress, newlyCompleted });
    // ╚══ SFARSIT Listing 4.5 ══════════════════════════════════════╝
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

    // O(n) map build instead of O(n×7) repeated filter passes
    const countByDate = new Map();
    for (const row of rows) {
      const key = row.lastListened.toISOString().slice(0, 10);
      countByDate.set(key, (countByDate.get(key) || 0) + 1);
    }

    const byDay = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      // Return the ISO date string — the frontend formats it in the user's locale
      return { day: key, count: countByDate.get(key) || 0 };
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

exports.createMultiChapterAudiobook = async (req, res) => {
  try {
    const { title, authorName, categoryName, description, chaptersData, language } = req.body;

    if (!title?.trim() || !authorName?.trim() || !categoryName?.trim()) {
      return res.status(400).json({ success: false, message: "Titlul, autorul și categoria sunt obligatorii." });
    }
    if (!req.files?.coverImage) {
      return res.status(400).json({ success: false, message: "Lipsește coperta!" });
    }

    const audioFiles = req.files?.audioFiles || [];
    if (audioFiles.length === 0) {
      return res.status(400).json({ success: false, message: "Adaugă cel puțin un capitol audio." });
    }

    let chaptersMetadata;
    try {
      chaptersMetadata = JSON.parse(chaptersData);
    } catch {
      return res.status(400).json({ success: false, message: "Date capitole invalide." });
    }

    if (!Array.isArray(chaptersMetadata) || chaptersMetadata.length !== audioFiles.length) {
      return res.status(400).json({ success: false, message: "Numărul de fișiere audio nu corespunde cu numărul de capitole." });
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SCREENSHOT: Listing 3.4 — Procesare paralelă Promise.all   ║
    // ║  Capturați de la 'Parse all durations' până la              ║
    // ║  '...audioFiles.map(f => uploadFromBuffer(...))' inclusiv    ║
    // ╚══════════════════════════════════════════════════════════════╝
    // Parse all durations in parallel
    const durations = await Promise.all(
      audioFiles.map(f =>
        mm.parseBuffer(f.buffer, { mimeType: f.mimetype })
          .then(meta => Math.round(meta.format.duration || 0))
          .catch(() => 0)
      )
    );

    const badIndex = durations.findIndex(d => d <= 0);
    if (badIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: `Nu s-a putut detecta durata pentru capitolul ${badIndex + 1}. Verifică formatul fișierului.`,
      });
    }

    // Upload cover + all chapters to Cloudinary in parallel
    const [coverResult, ...audioResults] = await Promise.all([
      uploadFromBuffer(req.files.coverImage[0].buffer, 'audiobooks/covers', 'image'),
      ...audioFiles.map(f => uploadFromBuffer(f.buffer, 'audiobooks/audio', 'video')),
    ]);
    // ╚══ SFARSIT Listing 3.4 ══════════════════════════════════════╝

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    const [author, category] = await Promise.all([
      prisma.author.upsert({
        where: { name: authorName },
        update: {},
        create: { name: authorName },
      }),
      prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      }),
    ]);

    const audiobook = await prisma.audiobook.create({
      data: {
        title,
        description: description || "",
        durationSeconds: totalDuration,
        coverImageUrl: coverResult.secure_url,
        audioFileUrl: audioResults[0].secure_url,
        language: sanitizeLanguage(language),
        authorId: author.id,
        categoryId: category.id,
        chapters: {
          create: chaptersMetadata.map((c, i) => ({
            title: c.title?.trim() || `Capitol ${i + 1}`,
            order: i,
            audioFileUrl: audioResults[i].secure_url,
            durationSeconds: durations[i],
          })),
        },
      },
      include: { author: true, category: true, chapters: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json({ success: true, data: audiobook });
  } catch (error) {
    console.error("Eroare la creare audiobook multi-capitol:", error);
    res.status(500).json({ success: false, message: "Eroare la adăugarea cărții." });
  }
};

exports.createAudiobook = async (req, res) => {
  try {
    const { title, authorName, categoryName, description, language } = req.body;

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

    const [coverResult, audioResult] = await Promise.all([
      uploadFromBuffer(req.files.coverImage[0].buffer, 'audiobooks/covers', 'image'),
      uploadFromBuffer(req.files.audioFile[0].buffer, 'audiobooks/audio', 'video'),
    ]);

    const [author, category] = await Promise.all([
      prisma.author.upsert({
        where: { name: authorName },
        update: {},
        create: { name: authorName },
      }),
      prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      }),
    ]);

    const newAudiobook = await prisma.audiobook.create({
      data: {
        title: title,
        description: description || "",
        durationSeconds: parsedDuration,
        coverImageUrl: coverResult.secure_url,
        audioFileUrl: audioResult.secure_url,
        language: sanitizeLanguage(language),
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