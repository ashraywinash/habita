import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET(request: Request) {
  // Optional: Add security here so only Vercel can trigger this route
  // if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const now = new Date().toISOString();

  // 1. FIND UNFINISHED TASKS PAST THEIR DEADLINE
  const { data: overdueTasks, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .lt('deadline', now);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  // 2. LEVY PENALTIES (Mark as failed, apply max penalty)
  let totalPenaltyDeducted = 0;

  if (overdueTasks && overdueTasks.length > 0) {
    for (const task of overdueTasks) {
      const penalty = -Math.abs(task.max_penalty); // Ensure it's a negative number
      totalPenaltyDeducted += penalty;

      await supabase
        .from('tasks')
        .update({ 
          status: 'failed', 
          net_points: penalty,
          completed_at: now 
        })
        .eq('id', task.id);
    }
  }

  // 3. CALCULATE DAILY BALANCE (Sum of all completed/failed tasks for today)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: todaysResolvedTasks } = await supabase
    .from('tasks')
    .select('net_points, status')
    .gte('completed_at', startOfDay.toISOString());

  const dailyBalance = todaysResolvedTasks?.reduce((sum, task) => sum + (task.net_points || 0), 0) || 0;
  const missedCount = overdueTasks?.length || 0;

  // 4. SEND THE EMAIL
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: ['ashuabc15@gmail.com', 'workwithutkarsh22@gmail.com'], 
    subject: `Daily Habit Report: Net ${dailyBalance >= 0 ? 'Gain' : 'Loss'} of ₹${Math.abs(dailyBalance)}`,
    html: `
      <h2>Daily Accountability Report</h2>
      <p>Today's net point balance is: <strong>₹${dailyBalance}</strong></p>
      <p>Tasks failed/ignored today: <strong>${missedCount}</strong> (Penalty of ₹${Math.abs(totalPenaltyDeducted)} automatically applied)</p>
      <hr />
      <p><em>The daily points meter has now reset. See you tomorrow.</em></p>
    `,
  });

  return NextResponse.json({ success: true, penalised: missedCount, balance: dailyBalance });
}