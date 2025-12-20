// lib/csv-writer.js
// A simple CSV writer implementation since we can't import the csv-writer npm package directly

/**
 * Creates an object that can convert arrays of objects to CSV strings
 * @param {Object} options Configuration options
 * @param {Array} options.header Array of header objects with id and title properties
 * @returns {Object} CSV stringifier object
 */
export function createObjectCsvStringifier(options) {
    const header = options.header || [];
    
    return {
      /**
       * Get the CSV header string
       * @returns {string} CSV header row
       */
      getHeaderString() {
        return header.map(field => escapeField(field.title)).join(',') + '\r\n';
      },
  
      /**
       * Convert records to CSV string
       * @param {Array} records Array of objects to convert to CSV
       * @returns {string} CSV string
       */
      stringifyRecords(records) {
        return records
          .map(record => {
            return header
              .map(field => {
                const value = record[field.id];
                return escapeField(value !== undefined && value !== null ? value : '');
              })
              .join(',');
          })
          .join('\r\n');
      }
    };
  }
  
  /**
   * Escape a field for CSV format
   * @param {*} value Field value to escape
   * @returns {string} Escaped field value
   */
  function escapeField(value) {
    const stringValue = String(value);
    
    // If the value contains a comma, double quote, or newline, enclose it in double quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      // Double the double quotes to escape them
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }