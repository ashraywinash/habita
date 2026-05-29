'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { differenceInMinutes } from 'date-fns';

export default function UserDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    
    // Define the exact boundaries of today in the local timezone
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      // Fetch ONLY tasks that are scheduled to be completed today
      .gte('deadline', startOfToday.toISOString())
      .lte('deadline', endOfToday.toISOString())
      .order('deadline', { ascending: true });
      
    if (!error && data) {
      setTasks(data);
      
      // Calculate net balance for today's resolved (completed/failed) tasks
      const todaysPoints = data
        .filter(t => t.status !== 'pending')
        .reduce((acc, task) => acc + (task.net_points || 0), 0);
      setBalance(todaysPoints);
    }
    setLoading(false);
  };

  const markComplete = async (task: any) => {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const minutesLate = differenceInMinutes(now, deadline);
    
    let netPoints = 0;
    
    if (minutesLate <= 0) {
      netPoints = task.reward_amount; // On time reward
    } else {
      const rawPenalty = minutesLate * task.penalty_rate;
      netPoints = -Math.min(rawPenalty, task.max_penalty); // Late penalty applied
    }

    await supabase
      .from('tasks')
      .update({ 
        status: 'completed', 
        completed_at: now.toISOString(), 
        net_points: netPoints 
      })
      .eq('id', task.id);

    fetchTasks(); // Automatically refreshes list and updates balance
  };

  // Separate tasks for granular UI layout
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const historyTasks = tasks.filter(t => t.status !== 'pending');

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Header Section */}
        <header className="flex justify-between items-end mb-10 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Today's Focus</h1>
            <p className="text-gray-400 mt-1">Clear your board before the midnight backend sweep.</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 uppercase tracking-wider">Today's Net Balance</p>
            <p className={`text-4xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-500'}`}>
              {balance >= 0 ? `+₹${balance}` : `-₹${Math.abs(balance)}`}
            </p>
          </div>
        </header>

        {loading ? (
          <div className="text-center text-gray-500 py-10">Loading today's schedule...</div>
        ) : (
          <div className="space-y-10">
            
            {/* 1. PENDING TASKS SECTION */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Pending Tasks ({pendingTasks.length})</h2>
              <div className="space-y-4">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-gray-700 transition-colors">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{task.title}</h3>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/50">
                          {task.priority.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Target Deadline: {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                
                {pendingTasks.length === 0 && (
                  <div className="text-center bg-gray-900/40 border border-dashed border-gray-800 text-gray-500 py-10 rounded-xl">
                    🎉 All pending tasks cleared for today!
                  </div>
                )}
              </div>
            </div>

            {/* 2. TODAY'S REVEALED LOG (COMPLETED / FAILED) */}
            {historyTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Today's Results</h2>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl divide-y divide-gray-800/60 overflow-hidden">
                  {historyTasks.map((task) => {
                    const isSuccess = task.status === 'completed' && task.net_points >= 0;
                    return (
                      <div key={task.id} className="p-4 flex justify-between items-center bg-gray-900/20">
                        <div>
                          <p className={`text-base font-medium ${task.status === 'failed' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                            {task.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {task.status === 'completed' 
                              ? `Completed at ${new Date(task.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'Auto-Failed by Backend Sweep'}
                          </p>
                        </div>
                        <div className={`text-sm font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                          {task.net_points >= 0 ? `+₹${task.net_points}` : `-₹${Math.abs(task.net_points)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}