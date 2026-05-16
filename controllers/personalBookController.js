const prisma = require('../lib/prisma');
const pdfExtract = require('pdf-extraction'); // <-- Folosim librăria modernă

// Funcția de Upload și Extragere Text
exports.uploadPersonalPdf = async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Te rog să încarci un fișier PDF." });
    }

    const existingCount = await prisma.personalBook.count({ where: { userId } });
    if (existingCount >= 50) {
      return res.status(400).json({ success: false, message: 'Limita de 50 de documente per cont a fost atinsă.' });
    }

    console.log("1. Am primit PDF-ul. Încep extragerea textului...");

    // Extragem textul folosind pdf-extraction (care acceptă direct buffer-ul din memorie)
    const pdfData = await pdfExtract(req.file.buffer);
    let extractedText = pdfData.text;
    extractedText = extractedText.replace(/\0/g, '');
    console.log(`2. Text extras cu succes! Număr de caractere: ${extractedText.length}`);

    const MAX_TEXT_CHARS = 500_000;
    if (extractedText.length > MAX_TEXT_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Documentul este prea mare (${Math.round(extractedText.length / 1000)}k caractere). Limita este 500k.`,
      });
    }

    // Salvăm în baza de date
    const newPersonalBook = await prisma.personalBook.create({
      data: {
        title: title || "Document Fără Titlu",
        content: extractedText, // Textul este acum un simplu șir de caractere (String)
        userId: userId
      }
    });

    console.log("3. Document salvat cu succes în baza de date!");
    res.status(201).json({ success: true, data: newPersonalBook });

  } catch (error) {
    console.error("Eroare la procesarea PDF-ului:", error);
    res.status(500).json({ success: false, message: "Eroare la citirea documentului PDF." });
  }
};

exports.deletePersonalBook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const book = await prisma.personalBook.findFirst({ where: { id, userId } });
    if (!book) return res.status(404).json({ success: false, message: 'Document not found.' });

    await prisma.personalBook.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyPersonalBooks = async (req, res) => {
  try {
    // Fetch content too — but only to measure its length, not to transmit it.
    // The frontend uses contentLength to estimate reading time without a
    // separate round-trip.
    const raw = await prisma.personalBook.findMany({
      where:   { userId: req.user.userId },
      select:  { id: true, title: true, createdAt: true, content: true },
      orderBy: { createdAt: 'desc' },
    });
    const books = raw.map(({ content, ...b }) => ({
      ...b,
      contentLength: content ? content.length : 0,
    }));
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Eroare de server.' });
  }
};

exports.getPersonalBookContent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const book = await prisma.personalBook.findFirst({
      where:  { id, userId },
      select: { id: true, title: true, content: true },
    });

    if (!book) return res.status(404).json({ success: false, message: 'Document negăsit.' });

    res.json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Eroare de server.' });
  }
};