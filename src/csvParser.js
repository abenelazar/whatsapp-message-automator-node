import { parse } from 'csv-parse';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

/**
 * Parse CSV file and return array of contact objects with dynamic fields
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array<Object>>} Array of contact objects
 */
export async function parseContactsCSV(filePath) {
  return new Promise((resolve, reject) => {
    const contacts = [];

    createReadStream(filePath)
      .pipe(parse({
        columns: true, // Use first row as headers
        skip_empty_lines: true,
        trim: true,
        cast: true,
        cast_date: false
      }))
      .on('data', (row) => {
        contacts.push(row);
      })
      .on('end', () => {
        resolve(contacts);
      })
      .on('error', (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      });
  });
}

/**
 * Validate that contacts have required phone field
 * @param {Array<Object>} contacts - Array of contact objects
 * @returns {Object} - Validation result with valid and invalid contacts
 */
export function validateContacts(contacts) {
  const valid = [];
  const invalid = [];

  contacts.forEach((contact, index) => {
    // Check for phone field (case-insensitive, with or without underscores)
    const phoneField = Object.keys(contact).find(key => {
      const normalized = key.toLowerCase().replace(/[_\s-]/g, '');
      return normalized === 'phone' || normalized === 'phonenumber';
    });

    if (phoneField && contact[phoneField]) {
      // Normalize phone field name to 'phone'
      if (phoneField !== 'phone') {
        contact.phone = contact[phoneField];
        delete contact[phoneField];
      }

      // Clean phone number (remove spaces, dashes, etc.)
      contact.phone = contact.phone.toString().replace(/[\s-()]/g, '');

      // Add + prefix if missing (assuming international format)
      if (!contact.phone.startsWith('+')) {
        contact.phone = '+' + contact.phone;
      }

      valid.push(contact);
    } else {
      invalid.push({ index: index + 2, contact, reason: 'Missing phone number' });
    }
  });

  return { valid, invalid };
}

/**
 * Get available fields from contacts
 * @param {Array<Object>} contacts - Array of contact objects
 * @returns {Array<string>} Array of field names
 */
export function getAvailableFields(contacts) {
  if (contacts.length === 0) return [];

  // Get all unique field names from all contacts
  const fields = new Set();
  contacts.forEach(contact => {
    Object.keys(contact).forEach(key => fields.add(key));
  });

  return Array.from(fields);
}
