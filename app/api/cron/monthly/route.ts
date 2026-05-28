import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const now = new Date();
  
  // Calculate first day and last day of current month
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Get all resolved tasks for the month
  const { data: monthlyTasks } = await supabase
    .from('tasks')
    .select('net_points')
    .neq('status', 'pending')
    .gte('completed_at', firstDay)
    .lte('completed_at', lastDay);

  const monthlyBalance = monthlyTasks?.reduce((acc, task) => acc + task.net_points, 0) || 0;
  const action = monthlyBalance >= 0 ? "DEPOSIT TO USER" : "WITHDRAW FROM USER";

  // Send Email
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'finance_admin@example.com', // REPLACE WITH YOUR ADMIN'S EMAIL
    subject: `Monthly Consolidated Receipt: ${action} ₹${Math.abs(monthlyBalance)}`,
    html: `
      <h2>Monthly Accountability Receipt</h2>
      <p>The month has concluded.</p>
      <p>Total Net Balance: <strong>₹${monthlyBalance}</strong></p>
      <p>Action Required: <strong>${action}</strong></p>
      <p><em>The monthly meter has now reset for the new month.</em></p>
    `,
  });

  return NextResponse.json({ success: true, monthlyBalance });
}