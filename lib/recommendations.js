function normalize(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

function buildRecommendations({ books, history, preferences, limit = 10 }) {
  const favoriteCategories = new Set(preferences.categories || []);
  const interests = (preferences.interests || [])
    .map(normalize)
    .filter((interest) => interest.length >= 2);
  const borrowedIds = new Set(history.map((item) => String(item.bookId)));
  const categoryWeights = new Map();
  const authorWeights = new Map();

  history.forEach((item, index) => {
    const recencyWeight = 1 / (1 + index * 0.25);
    const category = normalize(item.category);
    const author = normalize(item.author);
    if (category) {
      categoryWeights.set(category, (categoryWeights.get(category) || 0) + recencyWeight);
    }
    if (author) {
      authorWeights.set(author, (authorWeights.get(author) || 0) + recencyWeight);
    }
  });

  const hasPersonalSignals =
    favoriteCategories.size > 0 || interests.length > 0 || categoryWeights.size > 0 || authorWeights.size > 0;

  return books
    .filter((book) => !borrowedIds.has(String(book._id)))
    .map((book) => {
      let score = 0;
      const reasons = [];
      const category = normalize(book.category);
      const author = normalize(book.author);

      if (favoriteCategories.has(book.category)) {
        score += 8;
        reasons.push(`In a favorite category: ${book.category}`);
      }

      if (authorWeights.has(author)) {
        score += 4 * authorWeights.get(author);
        reasons.push("By an author you've borrowed before");
      }

      if (categoryWeights.has(category)) {
        score += 3 * categoryWeights.get(category);
        reasons.push(`Similar to your reading history in ${book.category}`);
      }

      const searchableContent = [
        book.title,
        book.author,
        book.category,
        book.description,
      ].map(normalize).join(' ');
      for (const interest of interests) {
        if (searchableContent.includes(interest)) {
          score += 5;
          reasons.push(`Matches your interest: ${interest}`);
        }
      }

      if (!hasPersonalSignals) {
        score = 1;
        reasons.push('Recently added to the library');
      }

      return { book, score, reasons };
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const dateDifference =
        new Date(right.book.createdAt || 0).getTime() -
        new Date(left.book.createdAt || 0).getTime();
      return dateDifference || String(right.book._id).localeCompare(String(left.book._id));
    })
    .slice(0, limit)
    .map(({ book, reasons }) => ({ book, reasons }));
}

module.exports = { buildRecommendations };
