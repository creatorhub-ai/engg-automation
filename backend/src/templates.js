const WELCOME_TEMPLATE = {
  id: 'welcome',
  subject: 'Welcome to the ({{batch_no}}) Course – Starting {{start_date}}',
  body: `
    <p>Dear Learners,</p>
    <p>Thank you for choosing ChipEdge Technologies as your learning partner!</p>
    <p>A warm welcome to the ({{batch_no}}) course. The training begins on {{start_date}}, at {{batch_time}}.</p>
    <p>I am Priyanka, your Learning Coordinator for this course, and your point of contact for any non-technical queries.<br>
    For IT-related support, contact Akash Kumar (IT Admin) at:<br>
    📧 support@chipedge.com</p>
    <p>
      Venue: ChipEdge Technologies,<br>
      <a href="https://maps.app.goo.gl/YreFTzfWe8wiFSCFA" target="_blank">📍 View Location</a>
    </p>
    <p>Feel free to reach out with any questions. Updates about timings, materials, and schedules will follow.<br>
    Stay tuned!</p>
    <p>Warm regards,<br>Priyanka | Learning Coordinator<br>📞 96060 56288</p>
  `
};

function renderTemplate(templateStr, data) {
  let rendered = templateStr;
  for (const key in data) {
    const re = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(re, data[key]);
  }
  return rendered;
}

module.exports = { WELCOME_TEMPLATE, renderTemplate };
