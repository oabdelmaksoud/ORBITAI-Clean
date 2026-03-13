import React from 'react';

interface DeleteTaskModalProps {
    taskToDelete: any | null;
    setTaskToDelete: (task: any | null) => void;
    confirmDeleteTask: () => void;
}

export const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({
    taskToDelete,
    setTaskToDelete,
    confirmDeleteTask
}) => {
    if (!taskToDelete) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTaskToDelete(null)}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4 border border-slate-200" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Task?</h3>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => setTaskToDelete(null)} className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg">Cancel</button>
                        <button onClick={confirmDeleteTask} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
