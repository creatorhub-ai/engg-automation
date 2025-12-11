// backend/email-worker.js - Standalone email scheduler for Render Cron Job
import { createClient } from '@supabase/supabase-js';
import { sendRawEmail } from './emailSender.js';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dotenv.config();
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Email Worker Started - Checking scheduled emails...');

async function processDueEmails() {
  try {
    const now = dayjs();
    const startOfMinute = now.startOf('minute').toISOString();
    const endOfMinute = now.endOf('minute').toISOString();
    
    console.log(`⏰ Checking emails for ${startOfMinute} to ${endOfMinute}`);
    
    // Fetch due emails (scheduled or failed) for this exact minute
    const { data: emails, error } = await supabase
      .from('scheduled_emails')
      .select('*')
      .in('status', ['scheduled', 'failed'])
      .gte('scheduled_at', startOfMinute)
      .lte('scheduled_at', endOfMinute)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('❌ Error fetching due emails:', error.message);
      return;
    }

    if (!emails || emails.length === 0) {
      console.log('📭 No emails scheduled for this minute');
      return;
    }

    console.log(`📨 Processing ${emails.length} emails...`);

    for (const email of emails) {
      console.log(`➡️ Processing mail ${email.id} to ${email.recipient_email} (${email.status})`);
      
      // Mark as processing
      const { error: markError } = await supabase
        .from('scheduled_emails')
        .update({ 
          status: 'processing', 
          retry_count: email.retry_count ? email.retry_count + 1 : 1,
          last_attempt_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', email.id)
        .in('status', ['scheduled', 'failed']);

      if (markError) {
        console.warn(`⚠️ Skipping mail ${email.id}: failed to mark as processing`);
        continue;
      }

      try {
        const html = email.body_html;
        const text = html?.replace(/<[^>]*>/g, '') || '';
        const attachments = [];
        
        if (email.attachement_name && email.attachement_data) {
          attachments.push({
            filename: email.attachement_name,
            content: Buffer.from(email.attachement_data, 'base64')
          });
        }

        const sendResult = await sendRawEmail({
          to: email.recipient_email,
          subject: email.subject || 'No subject',
          html,
          text,
          attachments
        });

        if (sendResult.success) {
          await supabase
            .from('scheduled_emails')
            .update({ 
              status: 'sent',
              sent_at: now.toISOString(),
              error: null,
              updated_at: now.toISOString(),
              message_id: sendResult.info?.messageId
            })
            .eq('id', email.id);
          console.log(`✅ Sent mail ${email.id} to ${email.recipient_email}`);
        } else {
          await supabase
            .from('scheduled_emails')
            .update({ 
              status: 'failed',
              error: sendResult.error || 'Unknown error',
              updated_at: now.toISOString()
            })
            .eq('id', email.id);
          console.log(`❌ Failed mail ${email.id}: ${sendResult.error}`);
        }
      } catch (ex) {
        await supabase
          .from('scheduled_emails')
          .update({ 
            status: 'failed',
            error: ex.message || 'Unknown error',
            updated_at: now.toISOString()
          })
          .eq('id', email.id);
        console.error(`💥 Exception mail ${email.id}:`, ex.message);
      }

      // Throttle to avoid SMTP flood
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (err) {
    console.error('💥 Cron job failure:', err.message);
  }
}

// Run immediately, then every minute
processDueEmails();
setInterval(processDueEmails, 60 * 1000);

console.log('✅ Email Worker running - checks every 60 seconds');
