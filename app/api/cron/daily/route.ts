import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // Security check: ensure the request comes from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const now = new Date();

  // 1. Find all pending tasks whose deadline has passed
  const { data: missedTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .lte('deadline', now.toISOString());

  // 2. Mark them as failed and apply MAX penalty
  if (missedTasks && missedTasks.length > 0) {
    for (const task of missedTasks) {
      await supabase
        .from('tasks')
        .update({ 
          status: 'failed', 
          net_points: -task.max_penalty,
          completed_at: now.toISOString() // Record when it failed
        })
        .eq('id', task.id);
    }
  }

  // 3. Calculate today's net balance
  // Start of today to end of today
  const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

  const { data: todaysTasks } = await supabase
    .from('tasks')
    .select('net_points')
    .neq('status', 'pending') // Get completed and failed tasks
    .gte('completed_at', startOfDay)
    .lte('completed_at', endOfDay);

  const dailyBalance = todaysTasks?.reduce((acc, task) => acc + task.net_points, 0) || 0;

  // 4. Send Email to Finance Admin
  await resend.emails.send({
    from: 'onboarding@resend.dev', // Default testing email for Resend
    to: 'ashuabc15@gmail.com', // REPLACE WITH YOUR ADMIN'S EMAIL
    subject: `Daily Habit Report: Net ${dailyBalance >= 0 ? 'Gain' : 'Loss'} of ₹${Math.abs(dailyBalance)}`,
    html: `
      <h2>Daily Accountability Report</h2>
      <p>Today's net point balance is: <strong>₹${dailyBalance}</strong></p>
      <p>Tasks failed today: ${missedTasks?.length || 0}</p>
      <p><em>The daily points meter has now reset.</em></p>
    `,
  });

  return NextResponse.json({ success: true, dailyBalance, missedTasks: missedTasks?.length });
}