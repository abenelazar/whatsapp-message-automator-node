import fs from 'fs/promises';

/**
 * Load message template from file
 * @param {string} filePath - Path to template file
 * @returns {Promise<string>} Template string
 */
export async function loadTemplate(filePath) {
  try {
    const template = await fs.readFile(filePath, 'utf-8');
    return template;
  } catch (error) {
    throw new Error(`Failed to load template from ${filePath}: ${error.message}`);
  }
}

/**
 * Render template with contact data
 * Supports various placeholder formats:
 * - {{fieldName}} - Standard format
 * - {fieldName} - Simple format
 * - ${fieldName} - Template literal style
 *
 * @param {string} template - Template string with placeholders
 * @param {Object} contact - Contact object with fields
 * @returns {string} Rendered message
 */
export function renderTemplate(template, contact) {
  let rendered = template;

  // Replace placeholders for each field in contact
  Object.keys(contact).forEach(field => {
    const value = contact[field] || '';

    // Support multiple placeholder formats
    const patterns = [
      new RegExp(`\\{\\{${field}\\}\\}`, 'gi'),  // {{fieldName}}
      new RegExp(`\\{${field}\\}`, 'gi'),         // {fieldName}
      new RegExp(`\\$\\{${field}\\}`, 'gi')       // ${fieldName}
    ];

    patterns.forEach(pattern => {
      rendered = rendered.replace(pattern, value);
    });
  });

  return rendered;
}

/**
 * Find all placeholders in template
 * @param {string} template - Template string
 * @returns {Array<string>} Array of placeholder names
 */
export function extractPlaceholders(template) {
  const placeholders = new Set();

  // Match {{field}}, {field}, ${field}
  const patterns = [
    /\{\{(\w+)\}\}/g,
    /\{(\w+)\}/g,
    /\$\{(\w+)\}/g
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(template)) !== null) {
      placeholders.add(match[1]);
    }
  });

  return Array.from(placeholders);
}

/**
 * Validate template against available contact fields
 * @param {string} template - Template string
 * @param {Array<string>} availableFields - Available field names
 * @returns {Object} Validation result
 */
export function validateTemplate(template, availableFields) {
  const placeholders = extractPlaceholders(template);
  const missingFields = placeholders.filter(p => !availableFields.includes(p));

  return {
    valid: missingFields.length === 0,
    placeholders,
    missingFields
  };
}
