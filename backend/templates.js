export function renderTemplate(templateStr, data = {}) {
  let rendered = templateStr || '';
  for (const key in data) {
    const re = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(re, data[key] ?? '');
  }
  return rendered;
}
