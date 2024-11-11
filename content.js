// content.js
function summarizeReviews() {
  function extractReviews() {
    let reviews = [];

    // Amazon review extraction
    const amazonReviews = document.querySelectorAll(
      '[data-hook="review-body"]'
    );
    if (amazonReviews.length > 0) {
      amazonReviews.forEach((review) => {
        reviews.push(review.textContent.trim());
      });
    }

    // eBay review extraction
    const ebayReviews = document.querySelectorAll(
      ".ux-reviews-component .review-item-content"
    );
    if (ebayReviews.length > 0) {
      ebayReviews.forEach((review) => {
        reviews.push(review.textContent.trim());
      });
    }

    return reviews;
  }

  function analyzeSentiment(text) {
    // Simple sentiment analysis
    const positiveWords = [
      "great",
      "good",
      "excellent",
      "amazing",
      "love",
      "perfect",
      "best",
    ];
    const negativeWords = [
      "bad",
      "poor",
      "terrible",
      "worst",
      "hate",
      "disappointing",
      "broken",
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    const words = text.toLowerCase().split(/\W+/);
    words.forEach((word) => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });

    return {
      sentiment:
        positiveCount > negativeCount
          ? "Positive"
          : positiveCount < negativeCount
          ? "Negative"
          : "Neutral",
      positiveCount,
      negativeCount,
    };
  }

  function summarize(reviews) {
    if (reviews.length === 0) return "No reviews found on this page.";

    const totalReviews = reviews.length;
    let overallSentiment = { positiveCount: 0, negativeCount: 0 };

    // Analyze each review
    reviews.forEach((review) => {
      const sentiment = analyzeSentiment(review);
      overallSentiment.positiveCount += sentiment.positiveCount;
      overallSentiment.negativeCount += sentiment.negativeCount;
    });

    // Calculate average review length
    const averageLength =
      reviews.reduce((sum, review) => sum + review.length, 0) / totalReviews;

    // Generate summary
    return `Summary of ${totalReviews} reviews:
  • Average review length: ${Math.round(averageLength)} characters
  • Overall sentiment: ${
    overallSentiment.positiveCount > overallSentiment.negativeCount
      ? "Mostly Positive"
      : overallSentiment.positiveCount < overallSentiment.negativeCount
      ? "Mostly Negative"
      : "Neutral"
  }
  • Positive mentions: ${overallSentiment.positiveCount}
  • Negative mentions: ${overallSentiment.negativeCount}`;
  }

  const reviews = extractReviews();
  return summarize(reviews);
}
