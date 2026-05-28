'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { differenceInMinutes } from 'date-fns';

export default function UserDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    // Get start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('tasks')
      .select('*')
      // Only show tasks that are pending OR were completed/failed TODAY
      .or(`status.eq.pending,completed_at.gte.${startOfToday.toISOString()}`) 
      .order('deadline', { ascending: true });
      
    if (data) {
      setTasks(data);
      // Balance naturally calculates only for today's tasks
      const todaysPoints = data
        .filter(t => t.status !== 'pending')
        .reduce((acc, task) => acc + (task.net_points || 0), 0);
      setBalance(todaysPoints);
    }
  };

  const markComplete = async (task: any) => {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const minutesLate = differenceInMinutes(now, deadline);
    
    let netPoints = 0;
    
    if (minutesLate <= 0) {
      netPoints = task.reward_amount; // On time!
    } else {
      const rawPenalty = minutesLate * task.penalty_rate;
      netPoints = -Math.min(rawPenalty, task.max_penalty); // Late - Apply capped penalty
    }

    await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: now.toISOString(), net_points: netPoints })
      .eq('id', task.id);

    fetchTasks(); // Refresh data
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-end mb-10 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Tasks</h1>
            <p className="text-gray-400 mt-1">Complete before the deadline to earn.</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 uppercase tracking-wider">Net Balance</p>
            <p className={`text-4xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-500'}`}>
              ₹{balance}
            </p>
          </div>
        </header>

        <div className="space-y-4">
          {tasks.filter(t => t.status === 'pending').map((task) => (
            <div key={task.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-gray-700 transition-colors">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold">{task.title}</h3>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-800">
                    {task.priority.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  Deadline: {new Date(task.deadline).toLocaleString()}
                </p>
              </div>
              
              <button 
                onClick={() => markComplete(task)}
                className="mt-4 md:mt-0 bg-green-600/10 hover:bg-green-600/20 text-green-500 border border-green-800/50 px-6 py-2 rounded-lg font-medium transition-all"
              >
                Mark Complete
              </button>
            </div>
          ))}
          
          {tasks.filter(t => t.status === 'pending').length === 0 && (
            <div className="text-center text-gray-500 py-10">No pending tasks. You're all caught up!</div>
          )}
        </div>
      </div>
    </div>
  );
}