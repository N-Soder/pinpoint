/** What the pin endpoints share. */

// A project stops accepting pins at this many, which bounds what one project
// can store and what a list request has to return. Deleting pins makes room.
export const MAX_PINS_PER_PROJECT = 1000;
export const MAX_PINS_LISTED = MAX_PINS_PER_PROJECT;

// Everything about a pin except the screenshot itself, which is large and is
// served separately to admins (GET /api/screenshots/:id).
export const PIN_COLUMNS = `
  id, project_id, page_url, element_selector, element_text, comment, author, browser,
  viewport, x_offset, y_offset, resolved, created_at,
  element_screenshot IS NOT NULL AS has_screenshot`;

export function coercePin(row) {
  return {
    ...row,
    resolved: row.resolved === 1 || row.resolved === true,
    has_screenshot: row.has_screenshot === 1 || row.has_screenshot === true,
  };
}
