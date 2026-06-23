const prisma = require('../lib/prisma');

exports.getReviews = async (req, res) => {
  try {
    const { audiobookId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { audiobookId },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const count = reviews.length;
    const averageRating = count > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / count
      : 0;

    res.json({ success: true, data: { reviews, count, averageRating } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserReview = async (req, res) => {
  try {
    const { audiobookId } = req.params;
    const userId = req.user.userId;

    const review = await prisma.review.findUnique({
      where: { userId_audiobookId: { userId, audiobookId } },
      select: { id: true, rating: true, comment: true, createdAt: true, updatedAt: true },
    });

    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.upsertReview = async (req, res) => {
  try {
    const { audiobookId } = req.params;
    const userId = req.user.userId;
    const { rating, comment } = req.body;

    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5.' });
    }
    if (comment && comment.length > 2000) {
      return res.status(400).json({ success: false, message: 'Comment must be at most 2000 characters.' });
    }

    const sanitizedComment = comment?.trim() || null;

    const review = await prisma.review.upsert({
      where: { userId_audiobookId: { userId, audiobookId } },
      update: { rating: ratingNum, comment: sanitizedComment },
      create: { userId, audiobookId, rating: ratingNum, comment: sanitizedComment },
      select: { id: true, rating: true, comment: true, createdAt: true, updatedAt: true },
    });

    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { audiobookId } = req.params;
    const userId = req.user.userId;

    await prisma.review.deleteMany({ where: { userId, audiobookId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
