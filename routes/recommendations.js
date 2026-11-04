const express = require('express');
const router = express.Router();

const { getCollection } = require('../lib/db');
const { buildRecommendations } = require('../lib/recommendations');
const requireAuth = require('../middleware/auth');

const categories = new Set(['Fiction', 'Science', 'History', 'Kids', 'Others']);
const MAX_INTERESTS = 20;
const MAX_INTEREST_LENGTH = 60;

function validatePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Preferences must be a JSON object.' };
  }
  if (!Array.isArray(input.categories) || !Array.isArray(input.interests)) {
    return { error: 'categories and interests must be arrays.' };
  }
  if (input.categories.some((category) => !categories.has(category))) {
    return { error: 'Choose valid favorite book categories.' };
  }
  if (
    input.interests.length > MAX_INTERESTS ||
    input.interests.some(
      (interest) =>
        typeof interest !== 'string' ||
        !interest.trim() ||
        interest.trim().length > MAX_INTEREST_LENGTH,
    )
  ) {
    return {
      error: `Enter up to ${MAX_INTERESTS} interests, each between 1 and ${MAX_INTEREST_LENGTH} characters.`,
    };
  }

  return {
    value: {
      categories: [...new Set(input.categories)],
      interests: [...new Set(input.interests.map((interest) => interest.trim()))],
    },
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
    return res.status(400).json({ message: 'limit must be a whole number between 1 and 30.' });
  }

  try {
    const preferencesCollection = await getCollection('readerPreferences');
    const borrowsCollection = await getCollection('borrows');
    const booksCollection = await getCollection('books');

    const [savedPreferences, history] = await Promise.all([
      preferencesCollection.findOne({ userEmail: req.user.email }),
      borrowsCollection
        .find({ userEmail: req.user.email })
        .sort({ borrowDate: -1 })
        .project({ bookId: 1, borrowDate: 1, bookAuthor: 1, bookCategory: 1 })
        .toArray(),
    ]);

    const borrowedBookIds = [...new Map(
      history.map((item) => [String(item.bookId), item.bookId]),
    ).values()];
    const [historyBooks, availableBooks] = await Promise.all([
      borrowedBookIds.length
        ? booksCollection.find({ _id: { $in: borrowedBookIds } }).toArray()
        : [],
      booksCollection
        .find({
          totalCopies: { $gt: 0 },
          ...(borrowedBookIds.length ? { _id: { $nin: borrowedBookIds } } : {}),
        })
        .toArray(),
    ]);
    const historyBookById = new Map(historyBooks.map((book) => [String(book._id), book]));
    const historySignals = history.map((item) => {
      const book = historyBookById.get(String(item.bookId));
      return {
        bookId: item.bookId,
        category: book?.category || item.bookCategory,
        author: book?.author || item.bookAuthor,
      };
    });
    const preferences = {
      categories: savedPreferences?.categories || [],
      interests: savedPreferences?.interests || [],
    };

    return res.json({
      recommendations: buildRecommendations({
        books: availableBooks,
        history: historySignals,
        preferences,
        limit,
      }),
      preferences,
      historyCount: history.length,
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/preferences', requireAuth, async (req, res, next) => {
  const validation = validatePreferences(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });

  try {
    const preferencesCollection = await getCollection('readerPreferences');
    const preferences = {
      userEmail: req.user.email,
      ...validation.value,
      updatedAt: new Date(),
    };
    await preferencesCollection.updateOne(
      { userEmail: req.user.email },
      { $set: preferences },
      { upsert: true },
    );
    return res.json({
      message: 'Your recommendation preferences have been saved.',
      preferences: validation.value,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
