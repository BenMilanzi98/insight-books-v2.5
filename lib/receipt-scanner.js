import Tesseract from 'tesseract.js';

const workerOptions = {
  // Decrease the number of words to recognize in each step for more frequent progress updates
  workerBlobURL: false,
  // Enable logging for more frequent progress updates
  logger: true,
  errorHandler: (err) => {
    console.error('Tesseract worker error:', err);
  }
};

/**
 * Extract information from a receipt image
 * @param {File} imageFile - The receipt image file
 * @param {Function} progressCallback - Callback function for progress updates
 * @returns {Promise<Object>} Extracted receipt data
 */
export async function scanReceipt(imageFile, progressCallback) {
    try {
      // Recognize text from the image and capture ALL status updates
      const result = await Tesseract.recognize(
        imageFile,
        'eng', // Language
        { 
          logger: m => {
            // Add detailed logging
            console.log(`OCR Status: ${m.status}, Progress: ${m.progress !== undefined ? Math.floor(m.progress * 100) : 'N/A'}%`);
            
            // Extract percentage from any status message with progress
            let progressPercent = 0;
            
            if (m.status === 'loading tesseract core') {
              progressPercent = m.progress ? Math.floor(m.progress * 10) : 0; // 0-10%
            } 
            else if (m.status === 'initializing tesseract') {
              progressPercent = 10 + (m.progress ? Math.floor(m.progress * 5) : 0); // 10-15%
            }
            else if (m.status === 'loading language traineddata') {
              progressPercent = 15 + (m.progress ? Math.floor(m.progress * 5) : 0); // 15-20%
            }
            else if (m.status === 'initializing api') {
              progressPercent = 20 + (m.progress ? Math.floor(m.progress * 5) : 0); // 20-25%
            }
            else if (m.status === 'recognizing text') {
              // The most important part - text recognition takes the most time
              progressPercent = 25 + (m.progress ? Math.floor(m.progress * 65) : 0); // 25-90%
            }
            
            // Always call the callback with any progress update
            if (typeof progressCallback === 'function') {
              progressCallback(progressPercent);
            }
          },
          langPath: 'https://tessdata.projectnaptha.com/4.0.0'
        }
      );
      
      const text = result.data.text;
      console.log("Extracted text:", text);
      
      // Parsing phase - 90-100%
      if (typeof progressCallback === 'function') {
        progressCallback(90);
      }
      
      // Parse the extracted text to find receipt details
      const extractedData = parseReceiptText(text);
      console.log("Parsed receipt data:", extractedData);
      
      // Complete
      if (typeof progressCallback === 'function') {
        progressCallback(100);
      }
      
      return extractedData;
    } catch (error) {
      console.error("Error scanning receipt:", error);
      throw error;
    }
  }
function parseReceiptText(text) {
  // Default return object
  const receiptData = {
    description: "Receipt Upload",
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: "Other"
  };
  
  // Clean up the text
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Extract merchant name (usually in the first few lines)
  receiptData.description = extractMerchantName(lines);
  
  // Extract date
  const dateMatch = findDate(text);
  if (dateMatch) {
    receiptData.date = formatDate(dateMatch);
  }
  
  // Extract amount
  const amountMatch = findAmount(text);
  if (amountMatch) {
    receiptData.amount = parseFloat(amountMatch);
  }
  
  // Guess category
  receiptData.category = guessCategory(text);
  
  return receiptData;
}

/**
 * Extract the merchant name from receipt text
 * @param {Array} lines - Lines of text from the receipt
 * @returns {string} Extracted merchant name
 */
function extractMerchantName(lines) {
  // Skip common receipt header text
  const skipWords = ['receipt', 'invoice', 'welcome', 'thank you', 'order', 'tel:', 'phone:'];
  
  // Check the first 5 lines for potential merchant name
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip short lines and common headers
    if (line.length < 3) continue;
    if (skipWords.some(word => line.toLowerCase().includes(word))) continue;
    
    // Skip lines that are dates or times
    if (line.match(/\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/)) continue;
    if (line.match(/\d{1,2}:\d{2}/)) continue;
    
    // Skip lines that are just numbers
    if (line.match(/^[\d\s\.\,\$]+$/)) continue;
    
    return line;
  }
  
  return "Receipt Upload";
}

/**
 * Find a date in the receipt text
 * @param {string} text - Receipt text
 * @returns {string|null} The found date or null
 */
function findDate(text) {
  // Look for common date formats (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
  const dateRegexes = [
    /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/, // MM/DD/YYYY or DD/MM/YYYY
    /(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})[\s]*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s]*[,\s]*(\d{2,4})/i, // DD Mon YYYY
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s]*(\d{1,2})[\s]*[,\s]*(\d{2,4})/i, // Mon DD YYYY
  ];
  
  for (const regex of dateRegexes) {
    const match = text.match(regex);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * Format a date string for consistency
 * @param {string} dateStr - The date string
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
function formatDate(dateStr) {
  try {
    // For simplicity, use the current date if parsing fails
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error("Error formatting date:", error);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Find the total amount on the receipt
 * @param {string} text - Receipt text
 * @returns {string|null} The found amount or null
 */
function findAmount(text) {
  // Look for common patterns for total amount
  const totalLabels = ['total', 'amount', 'grand total', 'balance', 'amount due', 'amount paid'];
  const lines = text.split('\n');
  
  // First try to find lines with total labels
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (totalLabels.some(label => lowerLine.includes(label))) {
      // Look for amount pattern in this line
      const amountMatch = line.match(/[\$\£\€]?\s*(\d+[\.,]\d{2})/);
      if (amountMatch) {
        return amountMatch[1].replace(',', '.');
      }
    }
  }
  
  // If no total line found, look for the largest currency amount (often the total)
  const allAmounts = [];
  const amountRegex = /[\$\£\€]?\s*(\d+[\.,]\d{2})/g;
  let match;
  while ((match = amountRegex.exec(text)) !== null) {
    allAmounts.push(parseFloat(match[1].replace(',', '.')));
  }
  
  // Return the largest amount found, if any
  if (allAmounts.length > 0) {
    return Math.max(...allAmounts);
  }
  
  return null;
}

/**
 * Guess the expense category based on receipt content
 * @param {string} text - Receipt text
 * @returns {string} Guessed category
 */
function guessCategory(text) {
  const lowerText = text.toLowerCase();
  
  // Food and dining
  if (lowerText.includes('restaurant') || 
      lowerText.includes('cafe') || 
      lowerText.includes('pizza') || 
      lowerText.includes('burger') ||
      lowerText.includes('food') ||
      lowerText.includes('menu') ||
      lowerText.includes('appetizer') ||
      lowerText.includes('dinner') ||
      lowerText.includes('lunch')) {
    return 'Meals & Entertainment';
  }
  
  // Transportation
  if (lowerText.includes('uber') || 
      lowerText.includes('lyft') || 
      lowerText.includes('taxi') || 
      lowerText.includes('cab') ||
      lowerText.includes('fare') ||
      lowerText.includes('train') ||
      lowerText.includes('bus') ||
      lowerText.includes('subway')) {
    return 'Travel';
  }
  
  // Office supplies
  if (lowerText.includes('office') || 
      lowerText.includes('staples') || 
      lowerText.includes('paper') || 
      lowerText.includes('ink') ||
      lowerText.includes('toner') ||
      lowerText.includes('pen') ||
      lowerText.includes('notebook')) {
    return 'Office Supplies';
  }
  
  // Utilities
  if (lowerText.includes('electric') || 
      lowerText.includes('water') || 
      lowerText.includes('utility') || 
      lowerText.includes('gas') ||
      lowerText.includes('power') ||
      lowerText.includes('energy')) {
    return 'Utilities';
  }
  
  // Software
  if (lowerText.includes('software') || 
      lowerText.includes('subscription') || 
      lowerText.includes('license') || 
      lowerText.includes('cloud') ||
      lowerText.includes('saas')) {
    return 'Software Subscription';
  }
  
  // Default
  return 'Other';
}