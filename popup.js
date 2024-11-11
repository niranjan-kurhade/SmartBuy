document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loader = document.querySelector('.loader');
    const progress = document.querySelector('.progress');
    const error = document.querySelector('.error');
    const summary = document.querySelector('.summary');
    const overview = document.getElementById('overview');
    const sentiment = document.getElementById('sentiment');
    const prosList = document.getElementById('prosList');
    const consList = document.getElementById('consList');
    const phrases = document.getElementById('phrases');
  
    analyzeBtn.addEventListener('click', async () => {
      resetUI();
      startLoading();
  
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        const [result] = await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          function: async function() {
            const SITE_CONFIGS = {
              amazon: {
                reviewSelectors: [
                  '[data-hook="review-body"] span',
                  '.review-text-content span',
                  '.review-text span'
                ],
                nextButtonSelectors: [
                  'li.a-last a',
                  '.a-pagination .a-last a'
                ],
                expandReviewsSelector: '#reviews-medley-footer .a-text-bold'
              },
              flipkart: {
                reviewSelectors: [
                  '._6K-7Co',
                  '.t-ZTKy'
                ],
                nextButtonSelectors: [
                  '._1LKTO3:last-child'
                ],
                expandReviewsSelector: '._3UAT2v'
              },
              ebay: {
                reviewSelectors: [
                  '.review-item-content p',
                  '[itemprop="reviewBody"]'
                ],
                nextButtonSelectors: [
                  '.ebay-pagination-button:last-child',
                  '.pagination__next'
                ]
              },
              myntra: {
                reviewSelectors: [
                  '.user-review-showHide',
                  '.user-review-value'
                ],
                nextButtonSelectors: [
                  '.pagination-next'
                ],
                expandReviewsSelector: '.detailed-reviews'
              }
            };
  
            async function sleep(ms) {
              return new Promise(resolve => setTimeout(resolve, ms));
            }
  
            function detectSite() {
              const hostname = window.location.hostname.toLowerCase();
              for (const site in SITE_CONFIGS) {
                if (hostname.includes(site)) return site;
              }
              return null;
            }
  
            async function expandReviews(siteConfig) {
              if (siteConfig.expandReviewsSelector) {
                const expandButton = document.querySelector(siteConfig.expandReviewsSelector);
                if (expandButton) {
                  expandButton.click();
                  await sleep(1000);
                }
              }
            }
  
            async function extractReviewsFromCurrentPage(siteConfig) {
              let reviews = [];
              await sleep(1000);
              
              for (let selector of siteConfig.reviewSelectors) {
                const reviewElements = document.querySelectorAll(selector);
                if (reviewElements.length > 0) {
                  reviewElements.forEach(review => {
                    const text = review.textContent.trim();
                    if (text && text.length > 10 && !text.toLowerCase().includes('read more')) {
                      reviews.push(text);
                    }
                  });
                  if (reviews.length > 0) break;
                }
              }
              
              return reviews;
            }
  
            async function goToNextPage(siteConfig) {
              for (let selector of siteConfig.nextButtonSelectors) {
                const nextButton = document.querySelector(selector);
                if (nextButton && 
                    !nextButton.disabled && 
                    !nextButton.parentElement?.classList.contains('a-disabled')) {
                  
                  const currentUrl = window.location.href;
                  nextButton.click();
                  
                  for (let i = 0; i < 10; i++) {
                    await sleep(500);
                    if (window.location.href !== currentUrl) {
                      await sleep(1500);
                      return true;
                    }
                  }
                }
              }
              return false;
            }
  
            function analyzeSentiment(text) {
              const positiveWords = ['great', 'good', 'excellent', 'amazing', 'love', 'perfect', 'best', 'awesome', 
                                    'fantastic', 'wonderful', 'happy', 'pleased', 'quality', 'recommend', 'comfortable'];
              const negativeWords = ['bad', 'poor', 'terrible', 'worst', 'hate', 'disappointing', 'broken', 'awful', 
                                    'horrible', 'defective', 'upset', 'useless', 'waste', 'uncomfortable', 'cheap'];
              
              let positiveCount = 0;
              let negativeCount = 0;
              
              const words = text.toLowerCase().split(/\W+/);
              words.forEach(word => {
                if (positiveWords.includes(word)) positiveCount++;
                if (negativeWords.includes(word)) negativeCount++;
              });
              
              return {positiveCount, negativeCount};
            }
  
            function analyzeProsCons(reviews) {
              const prosKeywords = ['pros:', 'pros-', 'positives:', 'liked:', 'good:', 'advantages:'];
              const consKeywords = ['cons:', 'cons-', 'negatives:', 'disliked:', 'bad:', 'disadvantages:'];
              
              let pros = [];
              let cons = [];
              
              reviews.forEach(review => {
                const sentences = review.split(/[.!?]+/).map(s => s.trim().toLowerCase());
                
                sentences.forEach((sentence, index) => {
                  if (prosKeywords.some(keyword => sentence.includes(keyword))) {
                    if (sentences[index + 1]) pros.push(sentences[index + 1]);
                  } else if (consKeywords.some(keyword => sentence.includes(keyword))) {
                    if (sentences[index + 1]) cons.push(sentences[index + 1]);
                  } else if (sentence.length > 10) {
                    const sentiment = analyzeSentiment(sentence);
                    if (sentiment.positiveCount > sentiment.negativeCount) {
                      pros.push(sentence);
                    } else if (sentiment.negativeCount > sentiment.positiveCount) {
                      cons.push(sentence);
                    }
                  }
                });
              });
              
              return {
                pros: [...new Set(pros)].slice(0, 5),
                cons: [...new Set(cons)].slice(0, 5)
              };
            }
  
            function findCommonPhrases(reviews) {
              const phrases = {};
              const stopWords = new Set(['and', 'the', 'this', 'that', 'but', 'have', 'has', 'had', 'was', 'were']);
              
              reviews.forEach(review => {
                const words = review.toLowerCase()
                                   .split(/\W+/)
                                   .filter(word => word.length > 2 && !stopWords.has(word));
                
                for (let i = 0; i < words.length - 1; i++) {
                  const phrase = `${words[i]} ${words[i + 1]}`;
                  phrases[phrase] = (phrases[phrase] || 0) + 1;
                }
              });
              
              return Object.entries(phrases)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([phrase, count]) => `${phrase} (${count})`);
            }
  
            const site = detectSite();
            if (!site) {
              return {
                success: false,
                message: "This website is not currently supported. Supported sites: Amazon, eBay, Flipkart, and Myntra."
              };
            }
  
            const siteConfig = SITE_CONFIGS[site];
            await expandReviews(siteConfig);
            
            let allReviews = [];
            const MAX_PAGES = 10;
            
            for (let page = 1; page <= MAX_PAGES; page++) {
              const pageReviews = await extractReviewsFromCurrentPage(siteConfig);
              if (pageReviews.length === 0 && page === 1) {
                return {
                  success: false,
                  message: "No reviews found. Make sure you're on a product page with reviews."
                };
              } else if (pageReviews.length === 0) {
                break;
              }
              
              allReviews = allReviews.concat(pageReviews);
              
              window.postMessage({
                type: 'REVIEW_PROGRESS',
                page: page,
                totalReviews: allReviews.length,
                site: site
              }, '*');
              
              if (page < MAX_PAGES) {
                const hasNextPage = await goToNextPage(siteConfig);
                if (!hasNextPage) break;
              }
            }
            
            let totalPositive = 0;
            let totalNegative = 0;
            
            allReviews.forEach(review => {
              const sentiment = analyzeSentiment(review);
              totalPositive += sentiment.positiveCount;
              totalNegative += sentiment.negativeCount;
            });
            
            const averageLength = allReviews.reduce((sum, review) => sum + review.length, 0) / allReviews.length;
            const commonPhrases = findCommonPhrases(allReviews);
            const prosCons = analyzeProsCons(allReviews);
            
            return {
              success: true,
              data: {
                site: site,
                totalReviews: allReviews.length,
                averageLength: Math.round(averageLength),
                sentiment: totalPositive > totalNegative ? 'Mostly Positive' : 
                           totalPositive < totalNegative ? 'Mostly Negative' : 'Neutral',
                positiveCount: totalPositive,
                negativeCount: totalNegative,
                commonPhrases: commonPhrases,
                pros: prosCons.pros,
                cons: prosCons.cons
              }
            };
          }
        });
  
        if (result.result.success) {
          displayResults(result.result.data);
        } else {
          showError(result.result.message);
        }
      } catch (error) {
        showError('Error: Could not analyze reviews. Please make sure you are on a supported product page.');
        console.error(error);
      } finally {
        stopLoading();
      }
    });
  
    function resetUI() {
      error.textContent = '';
      summary.style.display = 'none';
      prosList.innerHTML = '';
      consList.innerHTML = '';
    }
  
    function startLoading() {
      analyzeBtn.disabled = true;
      loader.style.display = 'block';
    }
  
    function stopLoading() {
      analyzeBtn.disabled = false;
      loader.style.display = 'none';
    }
  
    function showError(message) {
      error.textContent = message;
    }
  
    function displayResults(data) {
        summary.style.display = 'block';
        
        // Update overview section
        overview.textContent = `Analyzed ${data.totalReviews} reviews from ${data.site.charAt(0).toUpperCase() + data.site.slice(1)}`;
        overview.textContent += ` (avg. length: ${data.averageLength} characters)`;
        
        // Update sentiment section
        const sentimentPercentage = Math.round(
          (data.positiveCount / (data.positiveCount + data.negativeCount)) * 100
        );
        sentiment.textContent = `${data.sentiment} (${sentimentPercentage}% positive)`;
        
        // Update pros list
        data.pros.forEach(pro => {
          const li = document.createElement('li');
          li.textContent = pro.charAt(0).toUpperCase() + pro.slice(1);
          prosList.appendChild(li);
        });
        
        // Update cons list
        data.cons.forEach(con => {
          const li = document.createElement('li');
          li.textContent = con.charAt(0).toUpperCase() + con.slice(1);
          consList.appendChild(li);
        });
        
        // Update common phrases
        phrases.innerHTML = '';
        data.commonPhrases.forEach(phrase => {
          const span = document.createElement('span');
          span.className = 'phrase-badge';
          span.textContent = phrase;
          phrases.appendChild(span);
        });
      }
      
      // Listen for progress updates from content script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'REVIEW_PROGRESS') {
          const percent = Math.round((message.page / 10) * 100);
          progress.style.width = `${percent}%`;
          progress.setAttribute('aria-valuenow', percent);
          
          const statusText = `Analyzing page ${message.page}/10 - Found ${message.totalReviews} reviews`;
          document.querySelector('.progress-status').textContent = statusText;
        }
      });
    });