'use client';
import { useState } from 'react';
import { supabase } from '@/utils/supabase';

export default function AdminPage() {
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('imp');
  const [message, setMessage] = useState('');

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedDeadline = new Date(deadline);
    const now = new Date();

    // --- THE FIX: Time Travel Prevention ---
    if (selectedDeadline <= now) {
      setMessage('Error: Deadline cannot be in the past! (Did you mean 12:30 AM tomorrow?)');
      return; // Stop the function from submitting to the database
    }
    // ---------------------------------------

    const { error } = await supabase
      .from('tasks')
      .insert([{ title, deadline: selectedDeadline.toISOString(), priority }]);

    if (error) setMessage(`Error: ${error.message}`);
    else {
      setMessage('Task successfully assigned!');
      setTitle(''); setDeadline('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
        <h1 className="text-2xl font-bold mb-6 tracking-tight">Admin Control</h1>
        
        <form onSubmit={handleAddTask} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Task Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Deadline</label>
            <input type="datetime-local" required value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Priority Level</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all">
              <option value="imp">Important (₹50 Reward)</option>
              <option value="very_imp">Very Important (₹100 Reward)</option>
              <option value="very_very_imp">Critical (₹200 Reward)</option>
            </select>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors">
            Deploy Task
          </button>
        </form>
        {message && <p className="mt-4 text-center text-sm text-green-400">{message}</p>}
      </div>
    </div>
  );
}